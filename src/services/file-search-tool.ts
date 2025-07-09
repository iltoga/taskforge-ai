import { uploadedFileToImageDataUrl } from "@/lib/image-helpers";
import {
  deleteFilesFromOpenAIStorage,
  generateTextWithProvider,
  getProviderConfigByModel,
  uploadFileToProvider,
  type AIProviderConfig,
} from "@/lib/openai";

const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
const DEFAULT_FILE_SEARCH_MODEL: ModelType =
  (process.env.OPENAI_DEFAULT_FILE_SEARCH_MODEL as ModelType) || "gpt-4.1";

// Legacy OpenAI client for file operations that aren't yet supported by the wrapper
import { ModelType } from "../appconfig/models";
import { ProcessedFile } from "../types/files";
import path from "path";
import fs from "fs/promises";
export interface FileSearchResult {
  content: string;
  filename?: string;
  relevance?: number;
  method?: "file_search" | "vision_api" | "hybrid";
}

export class FileSearchTool {
  // Removed vectorStoreId and vector store logic
  private uploadedDocFileIds: string[] = []; // files suitable for vector store
  // file.bytes is of type Uint8Array | Buffer | ArrayBuffer
  private uploadedImages: Array<ProcessedFile> = [];
  private providerConfig: AIProviderConfig;
  private model: ModelType;

  constructor(model: ModelType = DEFAULT_FILE_SEARCH_MODEL) {
    // Backward compatibility: if first param is string, treat as API key
    this.providerConfig = getProviderConfigByModel(model);
    this.model = model;
  }

  /*
  / initialize method with separate document and image handling
  / This method initializes the tool with processed files, uploading non-image files to OpenAI Storage for file search and storing image data for vision API.
  / note: for now we only support OpenAI Storage for file search of non-image files
  */
  async initialize(
    instructions?: string,
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

    console.log("🚀 FileSearchTool.initializeWithFiles() START");
    console.log("🚀 Document FileIds received:", this.uploadedDocFileIds);
    console.log(
      "🚀 Image data received:",
      this.uploadedImages.length,
      "images"
    );
    console.log("🚀 Model selected:", this.model);
    console.log("🚀 Instructions length:", instructions?.length || 0);

    try {
      // Upload non‑image files and store IDs
      this.uploadedDocFileIds = await this.uploadProcessedFilesToStore(
        processedFiles
      );

      // Store image buffers for the vision API
      this.uploadedImages = processedFiles.filter((file) => file.isImage);
      if (this.uploadedImages.length === 0) {
        console.debug("ℹ️ No image files found in processed files");
      }

      // Abort if we still have nothing
      if (
        this.uploadedDocFileIds.length === 0 &&
        this.uploadedImages.length === 0
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

      console.log("🎉 FileSearchTool.initializeWithFiles() COMPLETE");
      console.log("🎉 Images ready:", this.uploadedImages.length);
    } catch (error) {
      console.error("💥 FileSearchTool.initializeWithFiles() ERROR:", error);
      console.error(
        "💥 Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      throw error;
    }
  }

  async searchFiles(query: string): Promise<FileSearchResult[]> {
    // Determine mode
    const hasFiles = this.uploadedDocFileIds.length > 0;
    const hasImages = this.uploadedImages.length > 0;

    if (!hasFiles && !hasImages) {
      throw new Error("No files or images available for search");
    }

    // Build image content for vision API
    const images: Array<{ imageData: string; mimeType: string }> = [];
    if (this.uploadedImages.length > 0) {
      for (const { fileName, fileType } of this.uploadedImages) {
        try {
          const base64ImageData = await uploadedFileToImageDataUrl(
            fileName,
            fileType
          );
          images.push({ imageData: base64ImageData, mimeType: fileType });
        } catch (err) {
          console.error(`Failed to process image file:`, err);
        }
      }
    }

    // Log mode
    if (hasFiles && hasImages) {
      console.log("🔎 Running hybrid file+image search");
    } else if (hasFiles) {
      console.log("🔎 Running file search (files only)");
    } else {
      console.log("🔎 Running vision search (images only)");
    }

    // Use the new wrapper for text generation with file search and vision
    const { text } = await generateTextWithProvider(
      query,
      this.providerConfig,
      {
        model: this.model,
        images: images.length > 0 ? images : undefined,
        fileIds: hasFiles ? this.uploadedDocFileIds : undefined,
        tools: hasFiles ? { file_search: { parameters: {} } } : undefined,
      }
    );

    let method: "file_search" | "vision_api" | "hybrid";
    if (hasFiles && hasImages) {
      method = "hybrid";
    } else if (hasFiles) {
      method = "file_search";
    } else {
      method = "vision_api";
    }

    return [
      {
        content: text,
        relevance: 1,
        method,
      },
    ];
  }

  // uploadProcessedFiles upload files of type not image to OpenAI for file search and return their IDs
  async uploadProcessedFilesToStore(
    processedFiles: Array<ProcessedFile>
  ): Promise<string[]> {
    // Filter out images (only upload non-image files)
    const filesToUpload = processedFiles.filter((file) => !file.isImage);
    if (filesToUpload.length === 0) {
      console.debug("No non-image files to upload for file search");
      return [];
    }

    // Upload all files in parallel
    const uploadResults = await Promise.all(
      filesToUpload.map(async (file) => {
        try {
          const response = await uploadFileToProvider(
            file.fileName,
            this.providerConfig,
            "user_data"
          );
          if (!response || typeof response.id !== "string") {
            throw new Error(
              `Failed to upload file ${file.fileName}: invalid or missing response ID`
            );
          }
          console.log(
            `Uploaded ${file.fileName} (${file.fileSize} bytes) with ID ${response.id} to OpenAI storage for file search`
          );
          return response.id;
        } catch (err) {
          console.error(`Failed to upload file ${file.fileName}:`, err);
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
    if (!this.uploadedDocFileIds.length && !this.uploadedImages.length) return;
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
      for (const image of this.uploadedImages) {
        try {
          const filePath = path.join(FILE_UPLOAD_DIR, image.fileName);
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted image file from disk: ${image.fileName}`);
        } catch (err) {
          console.error(`Failed to delete image file from disk:`, err);
        }
      }
    }
  }
}
