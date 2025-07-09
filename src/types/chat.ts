export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type ChatHistory = Array<ChatMessage>;
