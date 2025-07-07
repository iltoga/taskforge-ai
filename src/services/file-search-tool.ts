import OpenAI from 'openai';
// removed fs and path – not needed after refactor

import { bufferToBase64ImageDataUrl } from '../lib/image-helpers';

const DEFAULT_FILE_SEARCH_MODEL = process.env.OPENAI_DEFAULT_FILE_SEARCH_MODEL || 'gpt-4.1';

async function waitForVectorStoreReady(openai: OpenAI, id: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const store = await openai.vectorStores.retrieve(id);
    if (store.status === 'completed') return;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Vector store ${id} not ready after ${timeoutMs} ms`);
}

export interface FileSearchResult {
  content: string;
  filename?: string;
  relevance?: number;
  method?: 'file_search' | 'vision_api' | 'hybrid';
}


export class FileSearchTool {
  private openai: OpenAI;
  private vectorStoreId?: string;
  private docFileIds: string[] = [];   // files suitable for vector store
  private imageFileIds: string[] = []; // original images to embed

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }


  async initialize(fileIds: string[], instructions?: string, model: string = DEFAULT_FILE_SEARCH_MODEL): Promise<void> {
    if (fileIds.length === 0) {
      return; // No files to process
    }
    console.log('🚀 FileSearchTool.initialize() START');
    console.log('🚀 FileIds received:', fileIds);
    console.log('🚀 Model selected:', model);
    console.log('🚀 Instructions length:', instructions?.length || 0);
    try {
      // First, validate that the files exist AND log their metadata
      // Classify files
      const docFileIds: string[] = [];
      const imageFileIds: string[] = [];

      console.log('🔍 Validating & classifying files...');
      for (const fileId of fileIds) {
        try {
          const info = await this.openai.files.retrieve(fileId);
          const fname = (info.filename || '').toLowerCase();
          console.log(`✅ ${fname} (${info.bytes} bytes) status=${info.status}`);

          if (/\.(png|jpe?g|webp|gif)$/i.test(fname)) {
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
        const vectorStore = await this.openai.vectorStores.create({
          name: 'Calendar Assistant Files',
          file_ids: this.docFileIds,
        });
        this.vectorStoreId = vectorStore.id;
        console.log('✅ Vector store created:', this.vectorStoreId);
        await waitForVectorStoreReady(this.openai, this.vectorStoreId);
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
    if (!this.vectorStoreId && this.imageFileIds.length === 0) {
      throw new Error('No files available for search');
    }

    // Build image parts (base64 embed)
    interface InputImg { type:'input_image'; image_url:string; detail:'auto'|'low'|'high'; }
    const imgParts: InputImg[] = [];

    const pushImg = async (buf: Buffer, mime: string) => {
      const image_url = await bufferToBase64ImageDataUrl(buf, mime);
      imgParts.push({
        type: 'input_image',
        image_url,
        detail: 'auto',
      });
    };

    for (const fid of this.imageFileIds) {
      const info = await this.openai.files.retrieve(fid);
      if (!info.filename) continue;
      const mime = info.filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const buf  = Buffer.from(await (await this.openai.files.content(fid)).arrayBuffer());
      await pushImg(buf, mime);
    }

    // Build inputs
    type UserContentPart = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'auto' | 'low' | 'high' };
    const userContent: UserContentPart[] = [{ type:'input_text', text: query }, ...imgParts];

    const hasDocs = !!this.vectorStoreId;
    const resp = await this.openai.responses.create({
      model: DEFAULT_FILE_SEARCH_MODEL,
      ...(hasDocs && { tools: [{ type: 'file_search', vector_store_ids: [this.vectorStoreId!] }] }),
      input: [{ role: 'user', content: userContent }],
    });

    return [{
      content: resp.output_text,
      relevance: 1,
      method: imgParts.length && hasDocs ? 'hybrid' : (hasDocs ? 'file_search' : 'vision_api'),
    }];
  }


  async cleanup(): Promise<void> {
    if (!this.vectorStoreId) return;
    try {
      await this.openai.vectorStores.delete(this.vectorStoreId);
    } catch (error) {
      console.error('Error cleaning up vector store:', error);
    }
  }
}
