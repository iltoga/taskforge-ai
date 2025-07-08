import { AIProviderConfig, getProviderModelFactory } from '@/lib/openai';

// Example usage: create a model factory for OpenAI or OpenRouter
// You can change provider/model as needed
const config: AIProviderConfig = {
  provider: process.env.OPENAI_PROVIDER === 'openrouter' ? 'openrouter' : 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_BASE_URL,
};
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openaiOrRouter = getProviderModelFactory(config, model);

export { openaiOrRouter as openai }; // For local usage in this file only, not for re-export
