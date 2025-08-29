import { ModelType } from "@/appconfig/models";
import { uploadedFileToImageDataUrl } from "@/lib/image-helpers";
import {
  categorizeDocument,
  deleteFilesFromOpenAIStorage,
  generateTextWithProvider,
  getProviderConfigByModel,
  uploadFileToProvider,
  type AIProviderConfig,
} from "@/lib/openai";
import { DocumentInput, ProcessedFile } from "@/types/files";
import { PrismaClient, Document as PrismaDocument } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
const DEFAULT_FILE_SEARCH_MODEL: ModelType =
  (process.env.OPENAI_DEFAULT_FILE_SEARCH_MODEL as ModelType) || "gpt-5-mini";

export interface FileSearchResult {
  content: string;
  filename?: string;
  relevance?: number;
  method?: "file_search" | "vision_api" | "hybrid";
}

export class FileSearchService {
  // Removed vectorStoreId and vector store logic
  private uploadedDocFileIds: string[] = []; // files suitable for vector store
  // file.bytes is of type Uint8Array | Buffer | ArrayBuffer
  private uploadedDocImages: Array<ProcessedFile> = [];
  private providerConfig: AIProviderConfig;
  private processedFiles: Array<ProcessedFile> = [];
  private model: ModelType;
  private prisma: PrismaClient;

  constructor(model: ModelType = DEFAULT_FILE_SEARCH_MODEL) {
    // Backward compatibility: if first param is string, treat as API key
    this.providerConfig = getProviderConfigByModel(model);
    this.model = model;
    this.prisma = new PrismaClient();
  }

  getUploadedDocImages(): Array<ProcessedFile> {
    return this.uploadedDocImages;
  }
  getUploadedDocFileIds(): string[] {
    return this.uploadedDocFileIds;
  }
  getProcessedFiles(): Array<ProcessedFile> {
    return this.processedFiles;
  }

  /*
  / initialize method with separate document and image handling
  / This method initializes the tool with processed files, uploading non-image files to OpenAI Storage for file search and storing image data for vision API.
  / note: for now we only support OpenAI Storage for file search of non-image files
  */
  async initialize(
    instructions?: string, // Optional instructions for the model (unused for now)
    model: ModelType = DEFAULT_FILE_SEARCH_MODEL,
    processedFiles: Array<ProcessedFile> = []
  ): Promise<void> {
    // Update internal model if provided
    if (model !== DEFAULT_FILE_SEARCH_MODEL) {
      this.model = model;
    }
    if (processedFiles.length === 0) {
      console.warn("No files provided for initialization");
      return;
    }
    this.processedFiles = processedFiles;

    console.debug("🚀 FileSearchTool.initializeWithFiles() START");
    console.debug("🚀 Document FileIds received:", this.uploadedDocFileIds);
    console.debug(
      "🚀 Image data received:",
      this.uploadedDocImages.length,
      "images"
    );
    console.debug("🚀 Model selected:", this.model);
    console.debug("🚀 Instructions length:", instructions?.length || 0);
    console.debug(
      "🚀 ProcessedFiles debug:",
      processedFiles.map((f) => ({
        name: f.name,
        isImage: f.isImage,
        processAsImage: f.processAsImage,
        convertedImages: f.convertedImages,
      }))
    );

    try {
      // Upload non‑image files and store IDs
      this.uploadedDocFileIds = await this.uploadProcessedFilesToStore(
        processedFiles
      );

      // Store image buffers for the vision API
      this.uploadedDocImages = processedFiles.filter(
        (file) =>
          file.processAsImage ||
          (file.convertedImages && file.convertedImages.length > 0)
      );
      if (this.uploadedDocImages.length === 0) {
        console.debug("ℹ️ No image files found in processed files");
      }

      // Abort if we still have nothing
      if (
        this.uploadedDocFileIds.length === 0 &&
        this.uploadedDocImages.length === 0
      ) {
        console.warn("No files to process after upload");
        return;
      }

      // No vector store logic needed; just log file presence
      if (this.uploadedDocFileIds.length) {
        console.log("✅ Document files ready:", this.uploadedDocFileIds);
      } else {
        console.log("ℹ️ No document files to index");
      }

      console.debug("🎉 FileSearchTool.initializeWithFiles() COMPLETE");
      console.debug("🎉 Images ready:", this.uploadedDocImages.length);
    } catch (error) {
      console.error("💥 FileSearchTool.initializeWithFiles() ERROR:", error);
      console.error(
        "💥 Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      throw error;
    }
  }

  async searchFiles(query: string): Promise<FileSearchResult> {
    const hasFiles = this.uploadedDocFileIds.length > 0;
    const hasImages = this.uploadedDocImages.length > 0;
    if (!hasFiles && !hasImages)
      throw new Error("No files or images available for search");
    const mode: "file_search" | "vision_api" | "hybrid" =
      hasFiles && hasImages
        ? "hybrid"
        : hasFiles
        ? "file_search"
        : "vision_api";
    console.log(`🔎 Running ${mode.replace("_", " ")}`);
    const images = hasImages
      ? (
          await Promise.allSettled(
            this.uploadedDocImages.flatMap(
              ({ name: fileName, type: fileType, convertedImages }) =>
                (convertedImages?.length ? convertedImages : [fileName]).map(
                  async (name) => ({
                    imageData: await uploadedFileToImageDataUrl(name, fileType),
                    mimeType: fileType,
                  })
                )
            )
          )
        )
          .filter(
            (
              r
            ): r is PromiseFulfilledResult<{
              imageData: string;
              mimeType: string;
            }> => r.status === "fulfilled"
          )
          .map((r) => r.value)
      : [];
    const { text } = await generateTextWithProvider(
      `Please analyze the uploaded files and answer this query: ${query}. Provide a direct text response with the relevant information extracted from the files. Do not make any tool calls.`,
      this.providerConfig,
      {
        model: this.model,
        images: images.length ? images : undefined,
        fileIds: hasFiles ? this.uploadedDocFileIds : undefined,
        enableFileSearch: false, // Disable file_search to prevent tool call conflicts
        // The query is embedded in the input prompt to prevent tool calling confusion
      }
    );
    this.processedFiles.forEach((pf) => {
      void this.saveProcessedFileToDb(pf, text).catch((err) =>
        console.error("Failed to save processed file:", err)
      );
    });
    if (process.env.NODE_ENV !== "production")
      console.debug("📄 file-search result:\n", text);
    return { content: text, relevance: 1, method: mode };
  }

  // uploadProcessedFiles upload files of type not image to OpenAI for file search and return their IDs
  async uploadProcessedFilesToStore(
    processedFiles: Array<ProcessedFile>
  ): Promise<string[]> {
    // Filter out images (only upload non-image files)
    const filesToUpload = processedFiles.filter(
      (file) =>
        !file.isImage &&
        !file.processAsImage &&
        !(file.convertedImages && file.convertedImages.length > 0)
    );
    if (filesToUpload.length === 0) {
      console.debug("No non-image files to upload for file search");
      return [];
    }

    // Upload all files in parallel
    const uploadResults = await Promise.all(
      filesToUpload.map(async (file) => {
        try {
          const response = await uploadFileToProvider(
            file.name,
            this.providerConfig,
            "user_data"
          );
          if (!response || typeof response.id !== "string") {
            throw new Error(
              `Failed to upload file ${file.name}: invalid or missing response ID`
            );
          }
          console.log(
            `Uploaded ${file.name} (${file.size} bytes) with ID ${response.id} to OpenAI storage for file search`
          );
          return response.id;
        } catch (err) {
          console.error(`Failed to upload file ${file.name}:`, err);
          throw err; // Re-throw to handle upstream
        }
      })
    );
    return uploadResults;
  }

  /**
   * Remove all uploaded files from OpenAI storage (cleanup after search) and optionally delete image files from disk.
   * @param deleteDiskFiles - If true, delete image files from disk as well (default: true).
   * This method is called after the search is complete to clean up temporary files
   * and prevent unnecessary storage usage.
   * @returns A Promise that resolves when cleanup is complete.
   */
  async cleanup(deleteDiskFiles: boolean = false): Promise<void> {
    if (!this.uploadedDocFileIds.length && !this.uploadedDocImages.length)
      return;
    try {
      console.log(
        `🗑️ Cleaning up uploaded files from OpenAI storage and disk...`
      );
      // Delete document files from OpenAI storage
      if (this.uploadedDocFileIds.length > 0) {
        await deleteFilesFromOpenAIStorage(
          this.uploadedDocFileIds,
          this.providerConfig,
          deleteDiskFiles
        );
        console.log(
          `🗑️ Deleted files from OpenAI storage:`,
          this.uploadedDocFileIds
        );
      }
    } catch (err) {
      console.error(`Failed to delete files from OpenAI storage:`, err);
    }

    // Delete images if requested (delete the file on disk)
    if (deleteDiskFiles) {
      for (const image of this.uploadedDocImages) {
        try {
          const filePath = path.join(FILE_UPLOAD_DIR, image.name);
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted image file from disk: ${image.name}`);
        } catch (err) {
          console.error(`Failed to delete image file from disk:`, err);
        }
      }
    }
  }

  /**
   * Saves processed file to the database as a Document.
   * This method is called after the search is complete to store the processed files.
   * @param processedFile - The processed file to save.
   * @param llmText - The text generated by the LLM for this file.
   */
  async saveProcessedFileToDb(
    processedFile: ProcessedFile,
    llmText: string
  ): Promise<void> {
    const file = processedFile; // Use the processed file directly
    // categorize the file, if an image
    let category = "uncategorized";
    if (file.isImage || file.processAsImage) {
      // build the image data URL for the vision API (for each image in processedFile)
      const imageDataUrls = await Promise.all(
        file.convertedImages?.map((imageName) =>
          uploadedFileToImageDataUrl(imageName, "image/png")
        ) || []
      );
      if (!imageDataUrls) {
        console.error(
          `Failed to build image data URLs for file ${file.name}. No converted images found. I won't be able to categorize this file.`
        );
      } else {
        // categorize the file using the LLM
        category = await categorizeDocument({
          images: imageDataUrls,
        });
      }
    }

    // create a new DocumentInput for each file

    // Extract file extension from file name
    const fileName = file.name;
    const extension = fileName.includes(".")
      ? fileName.substring(fileName.lastIndexOf(".") + 1)
      : "";
    const originalFilePath = path.join(FILE_UPLOAD_DIR, fileName);
    // load file bytes from disk into a Buffer
    const fileBytes = await fs.readFile(originalFilePath);
    const documentData: DocumentInput = {
      name: fileName,
      size: file.size,
      extension,
      fileType: file.isImage ? "image" : "document",
      mimeType: file.type,
      data: fileBytes,
      rawOcrText: undefined, // No OCR text available for now
      rawLlmText: llmText,
      category,
    };
    try {
      if ((await this.createOrUpdateDocument(documentData)) !== null) {
        console.debug(`✅ Document ${fileName} saved successfully`);
        // await fs.unlink(originalFilePath);
      }
    } catch (error) {
      console.error(`Failed to save document ${fileName}:`, error);
    }

    return Promise.resolve();
  }

  /**
   * Create a new document record
   * @param data - Document fields (name, size, extension, fileType, mimeType, data, etc.)
   */
  async createOrUpdateDocument(
    data: DocumentInput
  ): Promise<PrismaDocument | null> {
    try {
      // Try to create the document
      return await this.prisma.document.create({ data });
    } catch (error: unknown) {
      // If unique constraint error (document with same name exists), update instead
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).code === "P2002"
      ) {
        try {
          return await this.prisma.document.update({
            where: { name: data.name },
            data,
          });
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Update an existing document by ID
   * @param id - Document ID
   * @param data - Fields to update
   */
  async updateDocument(
    id: number,
    data: Partial<DocumentInput>
  ): Promise<PrismaDocument | null> {
    try {
      return await this.prisma.document.update({
        where: { id },
        data,
      });
    } catch {
      return null;
    }
  }

  /**
   * Get single document by name (case-insensitive, partial match)
   * @param name - Name or partial name to search for
   */
  async getDocumentByNameFromDb(name: string): Promise<PrismaDocument | null> {
    try {
      return await this.prisma.document.findFirst({
        where: {
          name: {
            equals: name,
          },
        },
      });
    } catch {
      return null;
    }
  }

  /**
   * Delete a document by name (case-insensitive, partial match)
   * @param name - Name or partial name to search for
   */
  async deleteDocumentByName(name: string): Promise<boolean> {
    try {
      const document = await this.prisma.document.findFirst({
        where: {
          name: {
            equals: name,
          },
        },
      });
      if (!document) {
        return false;
      }
      await this.prisma.document.delete({
        where: { id: document.id },
      });
      return true;
    } catch {
      return false;
    }
  }
}
