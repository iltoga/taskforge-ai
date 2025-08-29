import { formatChatHistory } from "../services/orchestrator/utils";
import { ToolOrchestrator } from "../services/tool-orchestrator";

describe("Chat History Integration", () => {
  let orchestrator: ToolOrchestrator;

  beforeEach(() => {
    orchestrator = new ToolOrchestrator("test-api-key");
  });

  test("should format chat history correctly", () => {
    const chatHistory = [
      {
        id: "1",
        type: "user" as const,
        content: "Tell me about the Italmagneti project",
        timestamp: Date.now() - 10000,
      },
      {
        id: "2",
        type: "assistant" as const,
        content: "I found some events related to Italmagneti in your calendar.",
        timestamp: Date.now() - 5000,
      },
    ];

    const formatted = formatChatHistory(chatHistory);

    expect(formatted).toContain("USER: Tell me about the Italmagneti project");
    expect(formatted).toContain(
      "ASSISTANT: I found some events related to Italmagneti"
    );
    expect(formatted).toContain("[");
    expect(formatted).toContain("]");
  });

  test("should handle empty chat history", () => {
    const emptyHistory: any[] = [];

    const formatted = formatChatHistory(emptyHistory);

    expect(formatted).toBe("");
  });

  test("should handle null/undefined chat history", () => {
    const formatted1 = formatChatHistory(null as any);
    const formatted2 = formatChatHistory(undefined as any);

    expect(formatted1).toBe("");
    expect(formatted2).toBe("");
  });
});
