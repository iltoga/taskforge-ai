import { ModelType } from "@/appconfig/models";
import {
  createFileSignature,
  getFileSearchSignature,
  setFileSearchSignature,
} from "@/lib/file-search-session";
import { uploadedFileToImageDataUrl } from "@/lib/image-helpers";
import { categorizeDocument } from "@/lib/openai";
import { FileSearchService } from "@/services/file-search-service";
import { convertPdfToImageDataUrl } from "@/services/pdf-converter";
import { ProcessedFile } from "@/types/files";
import fs from "fs/promises";
import path from "path";
import { ToolResult } from "./tool-registry";

export class FileSearchTools {
  static category = "file-search";
  private fileSearchService: FileSearchService;
  private isInitialized = false;

  constructor() {
    this.fileSearchService = new FileSearchService();
  }

  /**
   * Initialize the file search tool with processed files
   */
  async initializeFileSearch(
    files: ProcessedFile[],
    model: ModelType = (process.env
      .OPENAI_DEFAULT_FILE_SEARCH_MODEL as ModelType) || "gpt-4.1-mini"
  ): Promise<ToolResult> {
    try {
      const currentSignature = createFileSignature(files);

      // Check if files have changed since last initialization
      if (currentSignature === (await getFileSearchSignature())) {
        this.isInitialized = true; // Set the flag even for cached initialization
        return {
          success: true,
          data: {
            message:
              "File search is already initialized with the provided files. You can proceed with 'searchFiles' action to query uploaded files.",
            fileCount: files.length,
            documentFiles: files.filter((f) => !f.isImage && !f.processAsImage)
              .length,
            imageDocFiles: files.filter((f) => f.isImage || f.processAsImage)
              .length,
          },
        };
      }

      await this.fileSearchService.initialize(undefined, model, files);
      this.isInitialized = true;

      // On successful initialization, store the new signature.
      await setFileSearchSignature(currentSignature);

      return {
        success: true,
        data: {
          message: "File search tool initialized successfully",
          fileCount: files.length,
          documentFiles: files.filter((f) => !f.isImage && !f.processAsImage)
            .length,
          imageDocFiles: files.filter((f) => f.isImage || f.processAsImage)
            .length,
        },
      };
    } catch (error) {
      this.isInitialized = false; // Ensure flag is false on failure
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize file search",
      };
    }
  }

  /**
   * Search through uploaded files using natural language queries.
   * This tool can also be used to extract structured data from a document.
   * To do so, provide a query that describes the data to be extracted and the desired JSON format.
   * For example: 'Extract the passport details from the document and return them as a JSON object with the following keys: passport_number, surname, given_names.'
   */
  async searchFiles(parameters: { query: string }): Promise<ToolResult> {
    const { query } = parameters;

    if (!this.isInitialized) {
      return {
        success: false,
        error: "No files or images available for search",
      };
    }

    try {
      const searchResult = await this.fileSearchService.searchFiles(query);

      return {
        success: true,
        data: {
          query,
          results: searchResult,
          method: searchResult.method || "unknown",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "File search failed",
      };
    }
  }

  async getDocumentByNameFromDb(
    name: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const document = await this.fileSearchService.getDocumentByNameFromDb(
        name
      );
      if (document) {
        return { success: true, data: document };
      } else {
        return { success: false, error: "Document not found" };
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Categorize a file (text or image) using LLM document categorization.
 * Supports text files and common image formats (png, jpg, jpeg, webp).
 * @param fileName - Absolute or relative path to the file, or just filename (will look in FILE_UPLOAD_DIR)
 * @param opts - Optional: { model?: ModelType }
 * @returns The detected category as a string, or throws on error
 */
export async function categorizeFile(
  fileName: string,
  opts: { model?: ModelType } = {}
): Promise<string> {
  const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";

  // Check if fileName is just a filename or a full path
  let filePath = fileName;
  if (!path.isAbsolute(fileName) && !fileName.includes("/")) {
    // It's just a filename, construct full path
    filePath = path.join(process.cwd(), FILE_UPLOAD_DIR, fileName);
  }

  // Check if the file exists, if not try to find converted images
  try {
    await fs.access(filePath);
  } catch {
    // File doesn't exist, check if there's a converted image version
    const baseName = path.basename(fileName, path.extname(fileName));
    const convertedImagePath = path.join(
      process.cwd(),
      FILE_UPLOAD_DIR,
      `${baseName}_p1.png`
    );

    try {
      await fs.access(convertedImagePath);
      filePath = convertedImagePath;
      fileName = `${baseName}_p1.png`; // Update fileName for proper extension detection
    } catch {
      throw new Error(
        `File not found: ${fileName} (tried ${filePath} and ${convertedImagePath})`
      );
    }
  }

  const ext = path.extname(fileName).toLowerCase();
  const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"];
  if (imageExts.includes(ext)) {
    // Use uploadedFileToImageDataUrl for consistent image conversion
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".bmp"
        ? "image/bmp"
        : ext === ".gif"
        ? "image/gif"
        : "application/octet-stream";

    // Use just the filename for uploadedFileToImageDataUrl (it constructs the path internally)
    const dataUrl = await uploadedFileToImageDataUrl(
      path.basename(filePath),
      mimeType
    );
    return categorizeDocument({ images: [dataUrl] }, opts);
  } else if (ext === ".pdf") {
    // Convert PDF to image data URLs and categorize
    const pdfBuffer = await fs.readFile(filePath);
    const pdfDataUrls = await convertPdfToImageDataUrl(pdfBuffer, true);
    return categorizeDocument({ images: pdfDataUrls });
  } else {
    // Assume text file
    const text = await fs.readFile(filePath, "utf-8");
    return categorizeDocument({ text }, opts);
  }
}
