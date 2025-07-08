// Type definitions for the OpenAI singleton and file operations
import OpenAI from 'openai';

export declare const openai: OpenAI;
export default openai;

// Extended types for file operations used by file-search-tool
export interface OpenAIFile {
  id: string;
  filename?: string;
  bytes: number;
  status: string;
}

export interface OpenAIVectorStore {
  id: string;
  name: string;
  status: string;
}

export interface OpenAIClient {
  files: {
    retrieve: (id: string) => Promise<OpenAIFile>;
    content: (id: string) => Promise<Response>;
  };
  vectorStores: {
    create: (params: { name: string; file_ids: string[] }) => Promise<OpenAIVectorStore>;
    retrieve: (id: string) => Promise<OpenAIVectorStore>;
    delete: (id: string) => Promise<void>;
  };
}
