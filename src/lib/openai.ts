import OpenAI from 'openai';

// Extend the global object to include the OpenAI instance
declare global {
  var __openai: OpenAI | undefined;
}

// Create the OpenAI singleton instance
const createOpenAIInstance = (): OpenAI => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// Singleton pattern using globalThis
export const openai = globalThis.__openai || createOpenAIInstance();

// Ensure the OpenAI instance is not recreated in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.__openai = openai;
}

export default openai;
