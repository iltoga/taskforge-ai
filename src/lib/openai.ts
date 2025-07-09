import { MODEL_CONFIGS, ModelType } from "@/appconfig/models";
import { openai as legacyOpenai } from "@/services/_openai-client";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";

const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
// Minimal valid tool object for OpenAI file_search tool (for Vercel AI SDK ToolSet)
const fileSearchTool = {
  description: "File search tool for OpenAI Responses API",
  parameters: z.object({
    file_ids: z.array(z.string()).describe("List of OpenAI file IDs to search"),
    query: z.string().describe("User query for file content search"),
  }),
};
/**
 * Upload a file to the correct provider using REST API.
 * For OpenAI: uses REST API /files endpoint (purpose: 'user_data' or 'vision').
 * For OpenRouter: throws (not supported).
 * Returns: { fileId: string, ... }
 */
export async function uploadFileToProvider(
  fileName: string,
  config: AIProviderConfig,
  purpose: "user_data" | "vision" = "user_data"
): Promise<{ fileId: string; [key: string]: unknown }> {
  if (config.provider !== "openai") {
    console.warn(
      "File upload is only supported for OpenAI provider. Defaulting to 'openai'."
    );
    config.provider = "openai";
  }
  // Use legacyOpenai client for file upload from disk
  try {
    const filePath = `${FILE_UPLOAD_DIR}/${fileName}`;
    const fs = await import("fs");
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const fileStream = fs.createReadStream(filePath);
    const response = await legacyOpenai.files.create({
      file: fileStream,
      purpose,
    });
    // Assume response contains an 'id' property for the file
    return { fileId: response.id, ...response };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenAI file upload failed: ${errorMsg}`);
  }
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
  if (config.provider === "openai") {
    if (opts?.responses) {
      return openai.responses(model);
    }
    return openai(model);
  } else if (config.provider === "openrouter") {
    return openrouter(model);
  }
  throw new Error("Unknown provider");
}

// --- Vercel AI SDK Unified Wrapper for OpenAI & OpenRouter ---
import { openai } from "@ai-sdk/openai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export type ProviderType = "openai" | "openrouter";

export interface AIProviderConfig {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// get api key by provider
export function getApiKeyByProvider(provider: ProviderType): string {
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY || "";
  } else if (provider === "openrouter") {
    return process.env.OPENROUTER_API_KEY || "";
  }
  throw new Error("Unknown provider");
}

export function getBaseUrlByProvider(provider: ProviderType): string {
  if (provider === "openai") {
    return DEFAULT_OPENAI_BASE_URL;
  } else if (provider === "openrouter") {
    return OPENROUTER_BASE_URL;
  }
  throw new Error("Unknown provider");
}

export function getProviderConfigByModel(
  model: ModelType,
  apiKey?: string,
  baseURL?: string
): AIProviderConfig {
  const provider = getProviderByModel(model);
  if (!apiKey) {
    apiKey = getApiKeyByProvider(provider);
  }
  if (!baseURL) {
    baseURL = getBaseUrlByProvider(provider);
  }
  return { provider, apiKey, baseURL };
}

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

import type { ToolSet } from "ai";

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
  const { images, fileIds, tools, model: modelName, ...rest } = options;
  let model: ModelType = modelName as ModelType;

  // Build messages array for text, images, and files
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  if (input) {
    content.push({ type: "text", text: input });
  }

  if (images && images.length) {
    for (const img of images) {
      // Vercel AI SDK expects images as { type: 'image', image: 'data:image/png;base64,...' }
      // If imageData is already a data URL, use it directly
      content.push({ type: "image", image: img.imageData });
    }
  }

  // File handling
  if (fileIds && fileIds.length) {
    if (config.provider !== "openai") {
      // force openai default model
      model = (process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini") as ModelType;
      config = getProviderConfigByModel(model);
    }
    // For OpenAI, files must be referenced via the file_search tool
    // The content array does not need to include file objects; instead, the tool is configured below
  }

  if (content.length) {
    messages.push({ role: "user", content });
  }

  // Select model factory
  let modelFactory;
  // if fileIds are provided, and provider is not OpenAI, use the default openai model for the provider
  if (config.provider !== "openai" && fileIds && fileIds.length) {
  }
  if (config.provider === "openai") {
    modelFactory = openai.responses(
      model || process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini"
    );
  } else if (config.provider === "openrouter") {
    modelFactory = openrouter(
      model || process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.5-flash"
    );
  } else {
    throw new Error("Unknown provider");
  }

  // For file search, add the file_search tool (as a string identifier) and pass file_ids in the request body
  let finalTools = tools;
  if (config.provider === "openai" && fileIds && fileIds.length) {
    // Check if we have a vector store ID (starts with 'vs_')
    const hasVectorStore = fileIds.some((id) => id.startsWith("vs_"));
    if (hasVectorStore) {
      // Use vector store IDs
      rest.tool_resources = {
        file_search: {
          vector_store_ids: fileIds.filter((id) => id.startsWith("vs_")),
        },
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
    model: modelFactory, // modelFactory is always LanguageModelV1
    messages,
    ...rest,
    ...(finalTools ? { tools: finalTools } : {}),
  };
  const { text, ...raw } = await generateText(
    generateTextArgs as {
      model: typeof modelFactory;
      messages: typeof messages;
      [key: string]: unknown;
    }
  );
  return { text, raw };
}

/**
 * Delete files from OpenAI storage by an array of file IDs.
 * Uses the OpenAI SDK client for deletion.
 * @param fileIds - Array of file IDs to delete
 * @param config - AIProviderConfig (must be OpenAI)
 */
export async function deleteFilesFromOpenAIStorage(
  fileIds: string[],
  config: AIProviderConfig,
  deleteFromDisk: boolean = true
): Promise<void> {
  if (config.provider !== "openai") {
    console.warn(
      "File deletion is only supported for OpenAI provider. Defaulting to 'openai'."
    );
    config.provider = "openai";
  }
  for (const fileId of fileIds) {
    if (deleteFromDisk) {
      // If deleteFromDisk is true, delete the file from disk first
      try {
        // Fetch file metadata from OpenAI to get the file name
        const fileMeta = await legacyOpenai.files.retrieve(fileId);
        const fileName = fileMeta.filename;
        if (!fileName) {
          console.warn(`No filename found for file ID ${fileId}. Skipping.`);
          continue;
        }
        const filePath = path.join(FILE_UPLOAD_DIR, fileName);
        await fs.unlink(filePath);
        console.log(`🗑️ Deleted file ${filePath} from disk.`);
      } catch (err) {
        console.error(
          `Failed to delete file for file ID ${fileId} from disk:`,
          err
        );
      }
    }
    try {
      // Delete the file from OpenAI storage
      await legacyOpenai.files.delete(fileId);
      console.log(`🗑️ Deleted file ${fileId} from OpenAI storage.`);
    } catch (err) {
      console.error(
        `Failed to delete file ${fileId} from OpenAI storage:`,
        err
      );
    }
  }
}

/**
 * Delete files from disk by their OpenAI file IDs.
 * For each file ID, fetch file metadata from OpenAI to get the file name, then unlink the file from disk.
 * @param fileIds - Array of OpenAI file IDs to delete from disk
 * @param config - AIProviderConfig (must be OpenAI)
 */
export async function deleteFilesFromDiskByIds(
  fileIds: string[],
  config: AIProviderConfig
): Promise<void> {
  if (config.provider !== "openai") {
    console.warn(
      "File deletion from disk is only supported for OpenAI provider. Defaulting to 'openai'."
    );
    config.provider = "openai";
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  for (const fileId of fileIds) {
    try {
      // Fetch file metadata from OpenAI to get the file name
      const fileMeta = await legacyOpenai.files.retrieve(fileId);
      const fileName = fileMeta.filename;
      if (!fileName) {
        console.warn(`No filename found for file ID ${fileId}. Skipping.`);
        continue;
      }
      const filePath = path.join(FILE_UPLOAD_DIR, fileName);
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted file ${filePath} from disk.`);
    } catch (err) {
      console.error(
        `Failed to delete file for file ID ${fileId} from disk:`,
        err
      );
    }
  }
}

/**
 * Get the provider ("openai" or "openrouter") for a given model.
 * @param model - The model ID (ModelType)
 * @returns The provider string ("openai" | "openrouter")
 */
export function getProviderByModel(model: ModelType): "openai" | "openrouter" {
  const config = MODEL_CONFIGS.find((m) => m.id === model);
  if (!config) throw new Error(`Unknown model: ${model}`);
  return config.provider;
}
