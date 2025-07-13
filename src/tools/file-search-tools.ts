import { ModelType } from "@/appconfig/models";
import {
  createFileSignature,
  getFileSearchSignature,
  setFileSearchSignature,
} from "@/lib/file-search-session";
import { FileSearchService } from "@/services/file-search-service";
import { ProcessedFile } from "@/types/files";
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
        error: "File search tool not initialized. Please upload files first.",
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

  /**
   * Clean up uploaded files and resources
   */
  async cleanupFiles(
    parameters: {
      deleteDiskFiles?: boolean;
    } = {}
  ): Promise<ToolResult> {
    const { deleteDiskFiles = false } = parameters;

    try {
      await this.fileSearchService.cleanup(deleteDiskFiles);
      this.isInitialized = false;

      return {
        success: true,
        data: {
          message: "File search resources cleaned up successfully",
          deletedDiskFiles: deleteDiskFiles,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      };
    }
  }

  async getDocumentByName(
    name: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const document = await this.fileSearchService.getDocumentByName(name);
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
