import fs from "fs/promises";
import path from "path";
import { ToolResult } from "./tool-registry";

export interface FileSearchFilters {
  name?: string;
  type?: "file" | "directory";
  maxResults?: number;
}

export class FileTools {
  static category = "file";

  /**
   * List files and directories in a given directory
   */
  async listFiles(directoryPath: string): Promise<ToolResult> {
    try {
      const items = await fs.readdir(directoryPath, { withFileTypes: true });
      const files = items.map((item) => ({
        name: item.name,
        type: item.isDirectory() ? "directory" : "file",
        path: path.join(directoryPath, item.name),
        size: item.isFile() ? 0 : undefined, // Would need stat for actual size
      }));

      return {
        success: true,
        message: `Found ${files.length} items in ${directoryPath}`,
        data: files,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Read content from a file
   */
  async readFile(filePath: string): Promise<ToolResult> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return {
        success: true,
        message: `Successfully read file: ${filePath}`,
        data: { content, path: filePath },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return {
        success: true,
        message: `Successfully wrote to file: ${filePath}`,
        data: { fileId: path.basename(filePath), path: filePath },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Search for files with optional filters
   */
  async searchFiles(
    directoryPath: string,
    filters: FileSearchFilters = {}
  ): Promise<ToolResult> {
    try {
      const items = await fs.readdir(directoryPath, { withFileTypes: true });
      let files = items
        .filter((item) => item.isFile())
        .map((item) => ({
          name: item.name,
          type: "file" as const,
          path: path.join(directoryPath, item.name),
        }));

      // Apply filters
      if (filters.name) {
        const namePattern = filters.name.replace(/\*/g, ".*");
        const regex = new RegExp(`^${namePattern}$`);
        files = files.filter((file) => regex.test(file.name));
      }

      if (filters.type) {
        files = files.filter((file) => file.type === filters.type);
      }

      if (filters.maxResults) {
        files = files.slice(0, filters.maxResults);
      }

      return {
        success: true,
        message: `Found ${files.length} files matching criteria`,
        data: files,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Create a new directory
   */
  async createDirectory(directoryPath: string): Promise<ToolResult> {
    try {
      await fs.mkdir(directoryPath, { recursive: true });
      return {
        success: true,
        message: `Successfully created directory: ${directoryPath}`,
        data: { path: directoryPath },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(
    sourcePath: string,
    destinationPath: string
  ): Promise<ToolResult> {
    try {
      await fs.copyFile(sourcePath, destinationPath);
      return {
        success: true,
        message: `Successfully copied file from ${sourcePath} to ${destinationPath}`,
        data: { sourcePath, destinationPath },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to copy file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Move/rename a file
   */
  async moveFile(
    sourcePath: string,
    destinationPath: string
  ): Promise<ToolResult> {
    try {
      await fs.rename(sourcePath, destinationPath);
      return {
        success: true,
        message: `Successfully moved file from ${sourcePath} to ${destinationPath}`,
        data: { sourcePath, destinationPath },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to move file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}
