import { generateTextWithProvider, type AIProviderConfig } from '@/lib/openai';
import { bufferToBase64ImageDataUrl } from '../lib/image-helpers';

const DEFAULT_FILE_SEARCH_MODEL = process.env.OPENAI_DEFAULT_FILE_SEARCH_MODEL || 'gpt-4.1';

// Legacy OpenAI client for file operations that aren't yet supported by the wrapper
import { openai as legacyOpenai } from './_openai-client';

import type OpenAI from 'openai';
import type { VectorStore } from 'openai/resources/vector-stores/vector-stores';

async function waitForVectorStoreReady(openaiClient: OpenAI, id: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const store: VectorStore = await openaiClient.vectorStores.retrieve(id);
    if (store.status === 'completed') return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Vector store ${id} not ready after ${timeoutMs} ms`);
}

export interface FileSearchResult {
  content: string;
  filename?: string;
  relevance?: number;
  method?: 'file_search' | 'vision_api' | 'hybrid';
}

export class FileSearchTool {
  private vectorStoreId?: string;
  private docFileIds: string[] = [];   // files suitable for vector store
  private imageFileIds: string[] = []; // original images to embed (legacy)
  private imageData: Array<{imageData: string, mimeType: string}> = []; // base64 image data
  private providerConfig: AIProviderConfig;
  private model: string;

  constructor(
    providerConfigOrApiKey?: AIProviderConfig | string,
    model: string = DEFAULT_FILE_SEARCH_MODEL
  ) {
    // Backward compatibility: if first param is string, treat as API key
    if (typeof providerConfigOrApiKey === 'string') {
      this.providerConfig = {
        provider: 'openai',
        apiKey: providerConfigOrApiKey
      };
    } else {
      this.providerConfig = providerConfigOrApiKey || {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY!
      };
    }
    this.model = model;
  }

  // New initialize method with separate document and image handling
  async initializeWithFiles(
    documentFileIds: string[] = [],
    imageData: Array<{imageData: string, mimeType: string}> = [],
    instructions?: string,
    model: string = DEFAULT_FILE_SEARCH_MODEL
  ): Promise<void> {
    // Update internal model if provided
    if (model !== DEFAULT_FILE_SEARCH_MODEL) {
      this.model = model;
    }

    if (documentFileIds.length === 0 && imageData.length === 0) {
      return; // No files to process
    }

    console.log('🚀 FileSearchTool.initializeWithFiles() START');
    console.log('🚀 Document FileIds received:', documentFileIds);
    console.log('🚀 Image data received:', imageData.length, 'images');
    console.log('🚀 Model selected:', this.model);
    console.log('🚀 Instructions length:', instructions?.length || 0);

    try {
      // Validate document files exist
      if (documentFileIds.length > 0) {
        console.log('🔍 Validating document files...');
        for (const fileId of documentFileIds) {
          try {
            const info = await legacyOpenai.files.retrieve(fileId);
            console.log(`✅ ${info.filename} (${info.bytes} bytes) status=${info.status}`);
          } catch (err) {
            console.error(`❌ File ${fileId} not accessible`, err);
            throw err;
          }
        }
      }

      this.docFileIds = documentFileIds;
      // Store image data directly (no file IDs needed)
      this.imageFileIds = []; // Not used with new API

      // Upload document files to vector store
      if (this.docFileIds.length) {
        const vectorStore = await legacyOpenai.vectorStores.create({
          name: 'Calendar Assistant Files',
          file_ids: this.docFileIds,
        });
        this.vectorStoreId = vectorStore.id;
        console.log('✅ Vector store created:', this.vectorStoreId);
        await waitForVectorStoreReady(legacyOpenai, this.vectorStoreId!);
        console.log('✅ Vector store ready');
      } else {
        console.log('ℹ️ No document files to index');
      }

      // Store image data for vision API
      this.imageData = imageData;

      console.log('🎉 FileSearchTool.initializeWithFiles() COMPLETE');
      console.log('🎉 Vector Store ID:', this.vectorStoreId);
      console.log('🎉 Images ready:', imageData.length);
    } catch (error) {
      console.error('💥 FileSearchTool.initializeWithFiles() ERROR:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  // Backward compatibility: keep the original initialize method signature
  async initialize(fileIds: string[], instructions?: string, model: string = DEFAULT_FILE_SEARCH_MODEL): Promise<void> {
    // Update internal model if provided
    if (model !== DEFAULT_FILE_SEARCH_MODEL) {
      this.model = model;
    }

    if (fileIds.length === 0) {
      return; // No files to process
    }
    console.log('🚀 FileSearchTool.initialize() START');
    console.log('🚀 FileIds received:', fileIds);
    console.log('🚀 Model selected:', this.model);
    console.log('🚀 Instructions length:', instructions?.length || 0);

    try {
      // First, validate that the files exist AND log their metadata
      // Classify files
      const docFileIds: string[] = [];
      const imageFileIds: string[] = [];

      console.log('🔍 Validating & classifying files...');
      for (const fileId of fileIds) {
        try {
          const info = await legacyOpenai.files.retrieve(fileId);
          const fname = (info.filename ?? '').toLowerCase();
          console.log(`✅ ${fname} (${info.bytes} bytes) status=${info.status}`);

          if (/(\.png|jpe?g|webp|gif)$/i.test(fname)) {
            imageFileIds.push(fileId);
          } else {
            docFileIds.push(fileId);
          }
        } catch (err) {
          console.error(`❌ File ${fileId} not accessible`, err);
          throw err;
        }
      }

      this.docFileIds = docFileIds;
      this.imageFileIds = imageFileIds;

      // Upload all files to vector store
      if (this.docFileIds.length) {
        const vectorStore = await legacyOpenai.vectorStores.create({
          name: 'Calendar Assistant Files',
          file_ids: this.docFileIds,
        });
        this.vectorStoreId = vectorStore.id;
        console.log('✅ Vector store created:', this.vectorStoreId);
        await waitForVectorStoreReady(legacyOpenai, this.vectorStoreId!);
        console.log('✅ Vector store ready');
      } else {
        console.log('ℹ️ No document files to index (images only)');
      }

      // (Final logs)
      console.log('🎉 FileSearchTool.initialize() COMPLETE');
      console.log('🎉 Vector Store ID:', this.vectorStoreId);
    } catch (error) {
      console.error('💥 FileSearchTool.initialize() ERROR:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  async searchFiles(query: string): Promise<FileSearchResult[]> {
    if (!this.vectorStoreId && this.imageFileIds.length === 0 && this.imageData.length === 0) {
      throw new Error('No files available for search');
    }

    // For now, use the wrapper for the main search but legacy client for file operations
    // In the future, when wrapper supports file operations, we can fully migrate

    // Build image content for vision API
    const images: Array<{ imageData: string; mimeType: string }> = [];

    // Use new imageData format if available
    if (this.imageData.length > 0) {
      images.push(...this.imageData);
    } else {
      // Fallback to legacy imageFileIds processing
      for (const fid of this.imageFileIds) {
        try {
          const info = await legacyOpenai.files.retrieve(fid);
          if (!info.filename) continue;

          const mime = (info.filename ?? '').toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          const buf = Buffer.from(await (await legacyOpenai.files.content(fid)).arrayBuffer());
          const imageData = await bufferToBase64ImageDataUrl(buf, mime);

          images.push({ imageData, mimeType: mime });
        } catch (err) {
          console.error(`Failed to process image file ${fid}:`, err);
        }
      }
    }

    // Use the new wrapper for text generation with file search and vision
    const { text } = await generateTextWithProvider(
      query,
      this.providerConfig,
      {
        model: this.model,
        images: images.length > 0 ? images : undefined,
        fileIds: this.vectorStoreId ? [this.vectorStoreId] : undefined,
        tools: this.vectorStoreId ? { file_search: { parameters: {} } } : undefined,
      }
    );

    return [{
      content: text,
      relevance: 1,
      method: images.length && this.vectorStoreId ? 'hybrid' : (this.vectorStoreId ? 'file_search' : 'vision_api'),
    }];
  }

  async cleanup(): Promise<void> {
    if (!this.vectorStoreId) return;
    try {
      // OpenAI SDK returns a VectorStoreDeleted object, not void
      await legacyOpenai.vectorStores.delete(this.vectorStoreId);
    } catch (error) {
      console.error('Error cleaning up vector store:', error);
    }
  }
}
