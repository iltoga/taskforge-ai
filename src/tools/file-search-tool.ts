import { ModelType } from "@/appconfig/models";
import { FileSearchService } from "@/services/file-search-service";
import { ProcessedFile } from "@/types/files";

export interface FileSearchResult {
  content: string;
  filename?: string;
  relevance?: number;
  method?: "file_search" | "vision_api" | "hybrid";
}

export interface ImageData {
  imageData: string;
  mimeType: string;
}

export class FileSearchTool {
  private fileSearchService: FileSearchService;
  private isInitialized = false;

  constructor(apiKey?: string, model: ModelType = "gpt-5-mini") {
    this.fileSearchService = new FileSearchService(model);
  }

  /**
   * Initialize the file search tool with file IDs
   */
  async initialize(
    fileIds: string[],
    instructions?: string,
    model?: ModelType
  ): Promise<void> {
    if (fileIds.length === 0) {
      this.isInitialized = true;
      return;
    }

    // Convert file IDs to ProcessedFile format
    const processedFiles: ProcessedFile[] = fileIds.map((id) => ({
      name: id,
      size: 0,
      type: "application/octet-stream",
      isImage: false,
      processAsImage: false,
      convertedImages: [],
    }));

    await this.fileSearchService.initialize(
      instructions,
      model,
      processedFiles
    );
    this.isInitialized = true;
  }

  /**
   * Initialize with both files and images
   */
  async initializeWithFiles(
    fileIds: string[],
    images: ImageData[],
    instructions?: string,
    model?: ModelType
  ): Promise<void> {
    // Convert file IDs to ProcessedFile format
    const processedFiles: ProcessedFile[] = [
      ...fileIds.map((id) => ({
        name: id,
        size: 0,
        type: "application/octet-stream",
        isImage: false,
        processAsImage: false,
        convertedImages: [],
      })),
      ...images.map((img, index) => ({
        name: `image_${index}`,
        size: 0,
        type: img.mimeType,
        isImage: true,
        processAsImage: true,
        convertedImages: [img.imageData],
      })),
    ];

    await this.fileSearchService.initialize(
      instructions,
      model,
      processedFiles
    );
    this.isInitialized = true;
  }

  /**
   * Search through uploaded files using natural language queries
   */
  async searchFiles(query: string): Promise<FileSearchResult[]> {
    if (!this.isInitialized) {
      throw new Error("FileSearchTool not initialized");
    }

    const result = await this.fileSearchService.searchFiles(query);
    return [result];
  }

  /**
   * Clean up resources
   */
  async cleanup(deleteDiskFiles: boolean = false): Promise<void> {
    await this.fileSearchService.cleanup(deleteDiskFiles);
    this.isInitialized = false;
  }

  /**
   * Get uploaded document images
   */
  getUploadedDocImages(): ProcessedFile[] {
    return this.fileSearchService.getUploadedDocImages();
  }

  /**
   * Get uploaded document file IDs
   */
  getUploadedDocFileIds(): string[] {
    return this.fileSearchService.getUploadedDocFileIds();
  }

  /**
   * Get processed files
   */
  getProcessedFiles(): ProcessedFile[] {
    return this.fileSearchService.getProcessedFiles();
  }
}
