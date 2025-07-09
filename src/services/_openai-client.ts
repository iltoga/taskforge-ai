// Export a real OpenAI client instance for legacy file/vector store operations
import OpenAI from "openai";

const isTest =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: process.env.OPENAI_BASE_URL,
  ...(isTest ? { dangerouslyAllowBrowser: true } : {}),
});

export { openai };
