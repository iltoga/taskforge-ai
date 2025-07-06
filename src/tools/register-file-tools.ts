import { z } from 'zod';
import { FileTools } from './file-tools';
import { ToolRegistry } from './tool-registry';

export function registerFileTools(registry: ToolRegistry, fileTools: FileTools) {
  registry.registerTool(
    {
      name: 'listFiles',
      description: 'List files and directories in a given path. Use this to explore directory contents.',
      parameters: z.object({
        directoryPath: z.string().describe('Path to the directory to list'),
        recursive: z.boolean().optional().describe('Whether to list recursively'),
      }),
      category: 'file'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { directoryPath: string; recursive?: boolean };
      return await fileTools.listFiles(p.directoryPath, p.recursive);
    }
  );

  registry.registerTool(
    {
      name: 'readFile',
      description: 'Read the content of a file. Use this to view file contents.',
      parameters: z.object({
        filePath: z.string().describe('Path to the file to read'),
      }),
      category: 'file'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { filePath: string };
      return await fileTools.readFile(p.filePath);
    }
  );

  registry.registerTool(
    {
      name: 'writeFile',
      description: 'Write content to a file. Use this to create or update files.',
      parameters: z.object({
        filePath: z.string().describe('Path where to write the file'),
        content: z.string().describe('Content to write to the file'),
        overwrite: z.boolean().optional().describe('Whether to overwrite if file exists'),
      }),
      category: 'file'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { filePath: string; content: string; overwrite?: boolean };
      return await fileTools.writeFile(p.filePath, p.content, p.overwrite);
    }
  );

  registry.registerTool(
    {
      name: 'searchFiles',
      description: 'Search for files with various criteria. Use this to find specific files.',
      parameters: z.object({
        searchPath: z.string().describe('Path to search in'),
        filters: z.object({
          name: z.string().optional().describe('Filter by file name pattern'),
          extension: z.string().optional().describe('Filter by file extension'),
          type: z.enum(['file', 'directory']).optional().describe('Filter by file type'),
          sizeMin: z.number().optional().describe('Minimum file size in bytes'),
          sizeMax: z.number().optional().describe('Maximum file size in bytes'),
          maxResults: z.number().optional().describe('Maximum number of results'),
        }).describe('Search criteria'),
      }),
      category: 'file'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { searchPath: string; filters: { name?: string; extension?: string; type?: 'file' | 'directory'; sizeMin?: number; sizeMax?: number; maxResults?: number } };
      return await fileTools.searchFiles(p.searchPath, p.filters);
    }
  );
}
