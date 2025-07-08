import { z } from 'zod';
// Minimal valid tool object for OpenAI file_search tool (for Vercel AI SDK ToolSet)
const fileSearchTool = {
  description: 'File search tool for OpenAI Responses API',
  parameters: z.object({
    file_ids: z.array(z.string()).describe('List of OpenAI file IDs to search'),
    query: z.string().describe('User query for file content search'),
  }),
};
/**
 * Upload a file to the correct provider using REST API.
 * For OpenAI: uses REST API /files endpoint (purpose: 'user_data' or 'vision').
 * For OpenRouter: throws (not supported).
 * Returns: { fileId: string, ... }
 */
export async function uploadFileToProvider(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  config: AIProviderConfig,
  purpose: 'user_data' | 'vision' = 'user_data'
): Promise<{ fileId: string; [key: string]: unknown }> {
  if (config.provider === 'openai') {
    // Use OpenAI REST API for file upload
    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
    form.append('purpose', purpose);
    const res: Response = await fetch(`${config.baseURL || DEFAULT_OPENAI_BASE_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI file upload failed: ${err}`);
    }
    const data = await res.json();
    return { fileId: data.id, ...data };
  } else if (config.provider === 'openrouter') {
    throw new Error('File upload is not supported for OpenRouter. Only text and images are supported.');
  }
  throw new Error('Unknown provider');
}
/**
 * Returns the correct model factory for the given provider and model.
 * Usage: const modelFactory = getProviderModelFactory({provider: 'openai', ...}, 'gpt-4o-mini', {responses: true})
 */
export function getProviderModelFactory(
  config: AIProviderConfig,
  model: string,
  opts?: { responses?: boolean }
): unknown {
  if (config.provider === 'openai') {
    if (opts?.responses) {
      return openai.responses(model);
    }
    return openai(model);
  } else if (config.provider === 'openrouter') {
    return openrouter(model);
  }
  throw new Error('Unknown provider');
}

// --- Vercel AI SDK Unified Wrapper for OpenAI & OpenRouter ---
import { openai } from '@ai-sdk/openai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

export type ProviderType = 'openai' | 'openrouter';

export interface AIProviderConfig {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
}

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * File upload is NOT supported via the Vercel AI SDK. Use the OpenAI REST API for file uploads if needed.
 * For vision/image input, pass the image as a message part to generateText (see below).
 */

/**
 * Generate text (and optionally vision/file search) with the correct provider.
 * If only images: both OpenAI and OpenRouter are supported.
 * If files+images: only OpenAI (Responses API, pass file IDs).
 *
 * @param input - user message or structured input
 * @param config - provider config
 * @param options - { images, fileIds, model, ... }
 */
export interface ImageInput {
  imageData: string;
  mimeType: string;
}

import type { ToolSet } from 'ai';

export interface GenerateTextOptions {
  images?: ImageInput[];
  fileIds?: string[];
  model?: string;
  tools?: ToolSet;
  [key: string]: unknown;
}

export interface GenerateTextResult {
  text: string;
  raw?: unknown;
}


export async function generateTextWithProvider(
  input: string,
  config: AIProviderConfig,
  options: GenerateTextOptions = {}
): Promise<GenerateTextResult> {
  const { images, fileIds, model, tools, ...rest } = options;

  // Build messages array for text, images, and files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  if (input) {
    content.push({ type: 'text', text: input });
  }

  if (images && images.length) {
    for (const img of images) {
      // Vercel AI SDK expects images as { type: 'image', image: 'data:image/png;base64,...' }
      // If imageData is already a data URL, use it directly
      content.push({ type: 'image', image: img.imageData });
    }
  }

  // File handling
  if (fileIds && fileIds.length) {
    if (config.provider === 'openrouter') {
      throw new Error('File search is not supported for OpenRouter. Use OpenAI for file search.');
    }
    // For OpenAI, files must be referenced via the file_search tool
    // The content array does not need to include file objects; instead, the tool is configured below
  }

  if (content.length) {
    messages.push({ role: 'user', content });
  }

  // Select model factory
  let modelFactory;
  if (config.provider === 'openai') {
    modelFactory = openai.responses(model || 'gpt-4.1-mini');
  } else if (config.provider === 'openrouter') {
    modelFactory = openrouter(model || 'google/gemini-2.5-flash');
  } else {
    throw new Error('Unknown provider');
  }

  // For file search, add the file_search tool (as a string identifier) and pass file_ids in the request body
  let finalTools = tools;
  if (config.provider === 'openai' && fileIds && fileIds.length) {
    // Check if we have a vector store ID (starts with 'vs_')
    const hasVectorStore = fileIds.some(id => id.startsWith('vs_'));
    if (hasVectorStore) {
      // Use vector store IDs
      rest.tool_resources = {
        file_search: {
          vector_store_ids: fileIds.filter(id => id.startsWith('vs_'))
        }
      };
    } else {
      // Use individual file IDs
      rest.file_ids = fileIds;
    }
    // Use a minimal valid tool object for file_search
    finalTools = { ...(tools || {}), file_search: fileSearchTool };
  }

  // Build the argument object for generateText
  const generateTextArgs = {
    model: modelFactory,
    messages,
    ...rest,
    ...(finalTools ? { tools: finalTools } : {}),
  };
  const { text, ...raw } = await generateText(generateTextArgs);
  return { text, raw };
}
