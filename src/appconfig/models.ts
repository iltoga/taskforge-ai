export type ModelType = 'gpt-4o' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'o3' | 'o3-mini' | 'o4-mini' | 'o4-mini-high' | 'google/gemini-2.0-flash-001' | 'nousresearch/hermes-2-pro-llama-3-8b' | 'google/gemini-2.5-flash-preview-05-20:thinking' | 'google/gemini-2.5-flash-preview-05-20' | 'google/gemini-2.5-flash-lite-preview-06-17' | 'microsoft/phi-4-reasoning-plus:free' | 'meta-llama/llama-4-maverick:free' | 'google/gemini-2.5-pro-preview' | 'deepseek/deepseek-r1-0528:free' | 'anthropic/claude-sonnet-4' | 'qwen/qwen3-30b-a3b:free';

export interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  icon: React.ReactNode;
  pricing: string;
  contextWindow: string;
  provider: 'openai' | 'openrouter';
  badge?: string;
  supportsAssistantAPI?: boolean;
  supportsFileSearch?: boolean;
}

// Model configuration that can be used on both client and server
export const MODEL_CONFIGS: Omit<ModelInfo, 'icon'>[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'OpenAI\'s most advanced model with improved reasoning and multimodal capabilities',
    pricing: '$10/1M tokens',
    contextWindow: '256K',
    provider: 'openai',
    badge: 'Premium',
    supportsAssistantAPI: true,
    supportsFileSearch: true
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Fast & cost-effective for most tasks',
    pricing: '$0.15/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    badge: 'Default',
    supportsAssistantAPI: true,
    supportsFileSearch: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Multimodal, great for complex tasks',
    pricing: '$5/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    supportsAssistantAPI: true,
    supportsFileSearch: true
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Latest reasoning model, cost-effective',
    pricing: '$1/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    badge: 'Reasoning',
    supportsAssistantAPI: true,
    supportsFileSearch: false
  },
  {
    id: 'o3',
    name: 'o3',
    description: 'Advanced reasoning capabilities',
    pricing: '$15/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    badge: 'Premium-Reasoning',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    description: 'Fast, general-purpose model with very low cost',
    pricing: '$0.15/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    badge: 'Fast',
    supportsAssistantAPI: false,
    supportsFileSearch: true
  },
  {
    id: 'o4-mini-high',
    name: 'o4-mini High',
    description: 'Better at coding and visual input',
    pricing: '$0.25/1M tokens',
    contextWindow: '128K',
    provider: 'openai',
    badge: 'Coding',
    supportsAssistantAPI: false,
    supportsFileSearch: true
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    description: 'Google Gemini 2.0 Flash via OpenRouter',
    pricing: '$0.10/1M tokens',
    contextWindow: '1M',
    provider: 'openrouter',
    badge: 'OpenRouter',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'nousresearch/hermes-2-pro-llama-3-8b',
    name: 'Hermes 2 Pro Llama 3 8B',
    description: 'Enhanced Llama 3 8B with function calling',
    pricing: '$0.025/1M tokens',
    contextWindow: '131K',
    provider: 'openrouter',
    badge: 'OpenRouter',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'google/gemini-2.5-flash-preview-05-20:thinking',
    name: 'Gemini 2.5 Flash (Thinking)',
    description: 'Advanced reasoning with thinking capability',
    pricing: '$0.15/1M input, $3.50/1M output',
    contextWindow: '1M',
    provider: 'openrouter',
    badge: 'Reasoning',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'google/gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash',
    description: 'State-of-the-art reasoning and coding',
    pricing: '$0.15/1M tokens',
    contextWindow: '1M',
    provider: 'openrouter',
    badge: 'OpenRouter',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'google/gemini-2.5-flash-lite-preview-06-17',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Lightweight version of Gemini 2.5 Flash',
    pricing: '$0.075/1M tokens',
    contextWindow: '1M',
    provider: 'openrouter',
    badge: 'OpenRouter',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'microsoft/phi-4-reasoning-plus:free',
    name: 'Phi-4 Reasoning Plus (Free)',
    description: 'Microsoft enhanced reasoning model',
    pricing: 'FREE',
    contextWindow: '33K',
    provider: 'openrouter',
    badge: 'Free',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    name: 'Llama 4 Maverick (Free)',
    description: 'Multimodal MoE model with 128 experts',
    pricing: 'FREE',
    contextWindow: '128K',
    provider: 'openrouter',
    badge: 'Free',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'google/gemini-2.5-pro-preview',
    name: 'Gemini 2.5 Pro Preview',
    description: 'Premium reasoning and coding model',
    pricing: '$1.25/1M input, $10/1M output',
    contextWindow: '1M',
    provider: 'openrouter',
    badge: 'Premium',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'deepseek/deepseek-r1-0528:free',
    name: 'DeepSeek R1 (Free)',
    description: 'Open reasoning model with thinking tokens',
    pricing: 'FREE',
    contextWindow: '164K',
    provider: 'openrouter',
    badge: 'Free',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Latest Anthropic model via OpenRouter',
    pricing: 'Variable',
    contextWindow: '200K',
    provider: 'openrouter',
    badge: 'OpenRouter',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  },
  {
    id: 'qwen/qwen3-30b-a3b:free',
    name: 'Qwen3 30B A3B (Free)',
    description: 'Latest Qwen MoE model with thinking mode',
    pricing: 'FREE',
    contextWindow: '41K',
    provider: 'openrouter',
    badge: 'Free',
    supportsAssistantAPI: false,
    supportsFileSearch: false
  }
];

// Helper function to get model information (server-safe)
export function getModelConfig(modelId: ModelType): Omit<ModelInfo, 'icon'> | undefined {
  return MODEL_CONFIGS.find(model => model.id === modelId);
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
