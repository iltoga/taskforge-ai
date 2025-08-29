import { MODEL_CONFIGS, ModelType } from "@/appconfig/models";
import { openai as legacyOpenai } from "@/services/_openai-client";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

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
 * Usage: const modelFactory = getProviderModelFactory({provider: 'openai', ...}, 'gpt-5-mini', {responses: true})
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
import type { CoreMessage, LanguageModelV1 } from "ai";
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
  imageData: string; // Base64 data URL (e.g., "data:image/png;base64,...")
  mimeType?: string; // Optional MIME type (e.g., "image/png")
}

import type { ToolSet } from "ai";

export interface GenerateTextOptions {
  images?: ImageInput[];
  fileIds?: string[];
  model?: string;
  tools?: ToolSet;
  enableFileSearch?: boolean; // Flag to control automatic file_search tool addition
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
  const {
    images,
    fileIds,
    tools,
    model: modelName,
    enableFileSearch = true,
    ...rest
  } = options;
  let model: ModelType = modelName as ModelType;

  // Build messages (typed) for the AI SDK
  const hasImages = Array.isArray(images) && images.length > 0;
  const messages: CoreMessage[] = [];
  if (hasImages) {
    const content = [] as Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    >;
    if (input) content.push({ type: "text", text: input });
    for (const img of images!) {
      content.push({ type: "image", image: img.imageData });
    }
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: input || "" });
  }
  // File handling: if we need file search with non-OpenAI, force OpenAI
  if (fileIds && fileIds.length) {
    if (config.provider !== "openai") {
      model = (process.env.OPENAI_DEFAULT_MODEL || "gpt-5-mini") as ModelType;
      const forced = getProviderConfigByModel(model);
      config.provider = forced.provider;
      config.apiKey = forced.apiKey;
      config.baseURL = forced.baseURL;
    }
  }

  // Select model factory (SDK path)
  // Use a relaxed type for modelFactory to accommodate test environments
  // where providers may be partially mocked.
  let modelFactory: unknown;
  if (config.provider === "openai") {
    // Some unit tests mock @ai-sdk/openai and may not provide the 'responses' factory.
    // Fall back to using the raw model string when unavailable to allow jest mocks of generateText to work.
    const anyOpenai: unknown = openai as unknown;
    const defaultModel =
      model || process.env.OPENAI_DEFAULT_MODEL || "gpt-5-mini";

    // For other models, use responses factory if available
    const hasResponses =
      anyOpenai &&
      typeof (anyOpenai as { responses?: (m: string) => unknown }).responses ===
        "function";
    if (hasResponses) {
      modelFactory = (
        anyOpenai as { responses: (m: string) => unknown }
      ).responses(defaultModel as string);
    } else {
      if (typeof anyOpenai === "function") {
        modelFactory = (anyOpenai as (m: string) => unknown)(
          defaultModel as string
        );
      } else {
        modelFactory = defaultModel as string;
      }
    }
  } else if (config.provider === "openrouter") {
    const anyOpenrouter: unknown = openrouter as unknown;
    const defaultModel =
      model ||
      process.env.OPENROUTER_DEFAULT_MODEL ||
      "google/gemini-2.0-flash-exp:free";
    if (typeof anyOpenrouter === "function") {
      // openrouter provider is a function that returns a model factory
      modelFactory = (anyOpenrouter as (m: string) => unknown)(
        defaultModel as string
      );
    } else {
      // Fallback: pass through the model id
      modelFactory = defaultModel as string;
    }
  } else {
    throw new Error("Unknown provider");
  }

  // For file search, add the file_search tool and pass file_ids where applicable
  let finalTools = tools;
  if (
    config.provider === "openai" &&
    fileIds &&
    fileIds.length &&
    enableFileSearch
  ) {
    const hasVectorStore = fileIds.some((id) => id.startsWith("vs_"));
    if (hasVectorStore) {
      rest.tool_resources = {
        file_search: {
          vector_store_ids: fileIds.filter((id) => id.startsWith("vs_")),
        },
      };
    } else {
      rest.file_ids = fileIds;
    }
    finalTools = { ...(tools || {}), file_search: fileSearchTool };
  } else if (
    config.provider === "openai" &&
    fileIds &&
    fileIds.length &&
    !enableFileSearch
  ) {
    rest.file_ids = fileIds;
  }

  const generateTextArgs = {
    model: modelFactory as LanguageModelV1,
    messages,
    ...rest,
    ...(finalTools ? { tools: finalTools } : {}),
  };

  const { text, ...raw } = await generateText(generateTextArgs);
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

// -------------------------------
// Document categorization via LLM
// -------------------------------

/**
 * Exactly one of `text` or `images` **must** be provided.
 */
export type CategorizeInput =
  | { text: string; images?: never }
  | { text?: never; images: string[] };

/**
 * Categorize a document (plain text OR array of base-64 “data:image/...;base64,” URLs) using an LLM.
 * If `opts.model` is omitted, the function falls back to:
 *   1. process.env.DEFAULT_CATEGORIZATION_MODEL
 *   2. process.env.OPENAI_DEFAULT_MODEL
 *   3. "gpt-5-mini"
 */
export async function categorizeDocument(
  input: CategorizeInput,
  opts: { model?: ModelType } = {}
): Promise<string> {
  const model: ModelType = (opts.model ||
    (process.env.DEFAULT_CATEGORIZATION_MODEL as ModelType) ||
    (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
    "gpt-5-mini") as ModelType;

  const providerConfig = getProviderConfigByModel(model);
  const categories = await readDocumentCategories();

  const promptHeader =
    `You are a document-categorization assistant.\n` +
    `Choose **exactly one** of the following categories for the given document:\n` +
    `${categories.join(", ")}\n` +
    `If none apply, answer "uncategorized".`;

  let userPrompt = "";
  let imagesPayload: ImageInput[] | undefined;

  if ("text" in input) {
    userPrompt = `${promptHeader}\n\nDocument:\n${input.text}`;
  } else {
    userPrompt = `${promptHeader}\n\nThe document is provided as image/s.`;
    imagesPayload = input.images.map((dataUrl) => {
      const mimeMatch = dataUrl.match(/^data:(.+?);base64,/);
      return {
        imageData: dataUrl,
        mimeType: mimeMatch ? mimeMatch[1] : "image/png",
      };
    });
  }

  const { text: llmReply } = await generateTextWithProvider(
    userPrompt,
    providerConfig,
    { model, images: imagesPayload }
  );

  const normalized = llmReply.trim().toLowerCase();
  const match = categories.find((c) => normalized.includes(c.toLowerCase()));
  return match || "uncategorized";
}

// function to read all categories from #environment
async function readDocumentCategories(): Promise<string[]> {
  const categories = await fs.readFile(
    path.resolve(process.cwd(), "settings/document-categories.json"),
    "utf-8"
  );
  return JSON.parse(categories).categories;
}
