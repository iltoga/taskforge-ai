import { getFileSearchSignature } from "@/lib/file-search-session";
import { ProcessedFile } from "@/types/files";
import { z } from "zod";
import { categorizeFile, FileSearchTools } from "./file-search-tools";
import {
  fileCategorizerToolDefinition,
  fileSearchToolDefinitions,
} from "./tool-definitions";
import { ToolRegistry } from "./tool-registry";

export function registerFileSearchTools(
  registry: ToolRegistry,
  fileSearchTools: FileSearchTools
): void {
  const TOOL_CATEGORY = "file-search";

  // Register fileCategorizer tool
  registry.registerTool(
    {
      name: "fileCategorizer",
      description: fileCategorizerToolDefinition.description,
      parameters: fileCategorizerToolDefinition.parameters,
      category: TOOL_CATEGORY,
    },
    async (parameters) => {
      const { fileName } = parameters as { fileName: string };
      try {
        const category = await categorizeFile(fileName);
        return { success: true, data: { category } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Register searchFiles tool
  registry.registerTool(
    {
      name: "searchFiles",
      description: fileSearchToolDefinitions.searchFiles.description,
      parameters: fileSearchToolDefinitions.searchFiles.parameters,
      category: TOOL_CATEGORY,
    },
    async (parameters) => {
      const { query } = parameters as {
        query: string;
      };

      // Add a guard to ensure initialization has occurred
      const currentSignature = await getFileSearchSignature();
      if (!currentSignature) {
        return {
          success: false,
          error: "No files or images available for search",
        };
      }

      return fileSearchTools.searchFiles({ query });
    }
  );

  registry.registerTool(
    {
      name: "initializeFileSearch",
      description: fileSearchToolDefinitions.initializeFileSearch.description,
      parameters: fileSearchToolDefinitions.initializeFileSearch.parameters,
      category: TOOL_CATEGORY,
    },
    async (parameters) => {
      const { files } = parameters as {
        files: Array<ProcessedFile>;
      };

      return fileSearchTools.initializeFileSearch(files);
    }
  );

  registry.registerTool(
    {
      name: "getDocumentByNameFromDb",
      description:
        fileSearchToolDefinitions.getDocumentByNameFromDb.description,
      parameters: z.object({
        name: z
          .string()
          .describe("Complete File name (e.g., passport_francisco.pdf)"),
      }),
      category: TOOL_CATEGORY,
    },
    async (params: Record<string, unknown>) => {
      if (typeof params.name !== "string") {
        return { success: false, error: "Missing or invalid name" };
      }
      return fileSearchTools.getDocumentByNameFromDb(params.name);
    }
  );

  // Note: The createOrUpdateDocument tool is commented out for now because for now it is performed automatically when processing files (not as part of the tool registry).
  // registry.registerTool(
  //   {
  //     name: "createOrUpdateDocument",
  //     description:
  //       "Create or update a document record in the database from an uploaded file. Use this to add or modify document information.",
  //     parameters: z.object({
  //       name: z.string().describe("File name (e.g., passport_francisco.pdf)"),
  //       size: z.number().describe("File size in bytes"),
  //       extension: z.string().describe("File extension (e.g., pdf, jpg)"),
  //       fileType: z
  //         .string()
  //         .describe("Type of the file (e.g., document, image)"),
  //       mimeType: z
  //         .string()
  //         .describe("MIME type of the file (e.g., application/pdf)"),
  //       data: z.instanceof(Buffer).describe("File data as a Buffer"),
  //       rawOcrText: z.string().optional().describe("OCR extracted text"),
  //       rawLlmText: z.string().optional().describe("LLM extracted text"),
  //       category: z
  //         .string()
  //         .optional()
  //         .default("other")
  //         .describe("File category (e.g., passport, document, image, other)"),
  //     }),
  //     category: TOOL_CATEGORY,
  //   },
  //   async (params: Record<string, unknown>) => {
  //     const data = {
  //       ...params,
  //     } as unknown as DocumentInput;
  //     return fileSearchTools.createOrUpdateDocument(data);
  //   }
  // );
}
