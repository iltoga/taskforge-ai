import { getFileSearchSignature } from "@/lib/file-search-session";
import { ProcessedFile } from "@/types/files";
import { z } from "zod";
import { FileSearchTools } from "./file-search-tools";
import { fileSearchToolDefinitions } from "./tool-definitions";
import { ToolRegistry } from "./tool-registry";

export function registerFileSearchTools(
  registry: ToolRegistry,
  fileSearchTools: FileSearchTools
): void {
  const TOOL_CATEGORY = "file-search";

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
      if (!getFileSearchSignature()) {
        return {
          success: false,
          error:
            "File search has not been initialized. Please call 'initializeFileSearch' first.",
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
      name: "getDocumentByName",
      description: fileSearchToolDefinitions.getDocumentByName.description,
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
      return fileSearchTools.getDocumentByName(params.name);
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

  // Register cleanupFiles tool
  registry.registerTool(
    {
      name: "cleanupFiles",
      description: fileSearchToolDefinitions.cleanupFiles.description,
      parameters: fileSearchToolDefinitions.cleanupFiles.parameters,
      category: TOOL_CATEGORY,
    },
    async (parameters) => {
      const { deleteDiskFiles } = parameters as { deleteDiskFiles?: boolean };
      const result = await fileSearchTools.cleanupFiles({ deleteDiskFiles });

      return result;
    }
  );
}
