export type ModelType =
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "gpt-4.1-nano"
  | "gpt-4o"
  | "o3"
  | "o4-mini"
  | "o4-mini-high"
  | "google/gemini-2.0-flash-001"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite-preview-06-17"
  | "microsoft/phi-4-reasoning-plus:free"
  | "meta-llama/llama-4-maverick:free"
  | "google/gemini-2.5-pro-preview"
  | "deepseek/deepseek-r1-0528:free"
  | "deepseek/deepseek-r1-0528-qwen3-8b"
  | "anthropic/claude-sonnet-4"
  | "x-ai/grok-4"
  | "moonshotai/kimi-k2:free";

export interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  icon: React.ReactNode;
  pricing: string;
  contextWindow: string;
  provider: "openai" | "openrouter";
  badge?: string;
  supportsAssistantAPI?: boolean;
  supportsFileSearch?: boolean;
}

// Model configuration that can be used on both client and server
export const MODEL_CONFIGS: Omit<ModelInfo, "icon">[] = [
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    description: "OpenAI's most advanced model",
    pricing: "$2-$8/1M tokens",
    contextWindow: "256K",
    provider: "openai",
    badge: "Premium",
    supportsAssistantAPI: true,
    supportsFileSearch: true,
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    description: "Fast & cost-effective",
    pricing: "$0.40-$1.60/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    badge: "Default",
    supportsAssistantAPI: true,
    supportsFileSearch: true,
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    description: "Ultra-fast, simple tasks",
    pricing: "$0.10-$0.40/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    badge: "Nano",
    supportsAssistantAPI: true,
    supportsFileSearch: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Multimodal, complex tasks",
    pricing: "$5/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    supportsAssistantAPI: true,
    supportsFileSearch: true,
  },
  {
    id: "o3",
    name: "o3",
    description: "Advanced reasoning",
    pricing: "$2-$8/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    badge: "Premium-Reasoning",
    supportsAssistantAPI: false,
    supportsFileSearch: true,
  },
  {
    id: "o4-mini",
    name: "o4-mini",
    description: "Fast, low cost",
    pricing: "$1.1-$4.4/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    badge: "Fast",
    supportsAssistantAPI: false,
    supportsFileSearch: true,
  },
  {
    id: "o4-mini-high",
    name: "o4-mini High",
    description: "Better coding & visual input",
    pricing: "$0.25/1M tokens",
    contextWindow: "128K",
    provider: "openai",
    badge: "Coding",
    supportsAssistantAPI: false,
    supportsFileSearch: true,
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    description: "Google Gemini 2.0 Flash",
    pricing: "$0.10/1M tokens",
    contextWindow: "1M",
    provider: "openrouter",
    badge: "OpenRouter",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Reasoning & coding",
    pricing: "$0.15/1M tokens",
    contextWindow: "1M",
    provider: "openrouter",
    badge: "OpenRouter",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "google/gemini-2.5-flash-lite-preview-06-17",
    name: "Gemini 2.5 Flash Lite",
    description: "Lightweight Gemini 2.5 Flash",
    pricing: "$0.075/1M tokens",
    contextWindow: "1M",
    provider: "openrouter",
    badge: "OpenRouter",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "microsoft/phi-4-reasoning-plus:free",
    name: "Phi-4 Reasoning Plus (Free)",
    description: "Microsoft reasoning model",
    pricing: "FREE",
    contextWindow: "33K",
    provider: "openrouter",
    badge: "Free",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "meta-llama/llama-4-maverick:free",
    name: "Llama 4 Maverick (Free)",
    description: "Multimodal MoE, 128 experts",
    pricing: "FREE",
    contextWindow: "128K",
    provider: "openrouter",
    badge: "Free",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro Preview",
    description: "Premium reasoning & coding",
    pricing: "$1.25/1M in, $10/1M out",
    contextWindow: "1M",
    provider: "openrouter",
    badge: "Premium",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1 (Free)",
    description: "Open reasoning model",
    pricing: "FREE",
    contextWindow: "164K",
    provider: "openrouter",
    badge: "Free",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "deepseek/deepseek-r1-0528-qwen3-8b",
    name: "DeepSeek R1 Qwen3 8B",
    description: "Distilled, excels at math/coding/logic",
    pricing: "$0.01-$0.02/1M tokens",
    contextWindow: "32K",
    provider: "openrouter",
    badge: "Distilled",
    supportsAssistantAPI: false,
    supportsFileSearch: true,
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    description: "Latest Anthropic model",
    pricing: "Variable",
    contextWindow: "200K",
    provider: "openrouter",
    badge: "OpenRouter",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "x-ai/grok-4",
    name: "Grok 4",
    description: "xAI's latest reasoning model",
    pricing: "$3-$15/1M tokens",
    contextWindow: "256K",
    provider: "openrouter",
    badge: "OpenRouter",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
  {
    id: "moonshotai/kimi-k2:free",
    name: "Kimi K2 (Free)",
    description: "Moonshot AI's latest reasoning model",
    pricing: "FREE",
    contextWindow: "128K",
    provider: "openrouter",
    badge: "Free",
    supportsAssistantAPI: false,
    supportsFileSearch: false,
  },
];

// Helper function to get model information (server-safe)
export function getModelConfig(
  modelId: ModelType
): Omit<ModelInfo, "icon"> | undefined {
  return MODEL_CONFIGS.find((model) => model.id === modelId);
}

// Helper function to check if a model supports Assistant API file search
export function supportsFileSearch(modelId: ModelType): boolean {
  const config = getModelConfig(modelId);
  return config?.supportsFileSearch === true;
}

// Helper function to check if a model supports Assistant API
export function supportsAssistantAPI(modelId: ModelType): boolean {
  const config = getModelConfig(modelId);
  return config?.supportsAssistantAPI === true;
}
