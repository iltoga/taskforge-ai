import { ToolOrchestrator } from '../services/tool-orchestrator';

describe('Chat History Integration', () => {
  let orchestrator: ToolOrchestrator;

  beforeEach(() => {
    orchestrator = new ToolOrchestrator('test-api-key');
  });

  test('should format chat history correctly', () => {
    const chatHistory = [
      {
        id: '1',
        type: 'user' as const,
        content: 'Tell me about the Italmagneti project',
        timestamp: Date.now() - 10000
      },
      {
        id: '2',
        type: 'assistant' as const,
        content: 'I found some events related to Italmagneti in your calendar.',
        timestamp: Date.now() - 5000
      }
    ];

    // Access the private method through any to test it
    const formatted = (orchestrator as any).formatChatHistory(chatHistory);

    expect(formatted).toContain('Previous conversation history:');
    expect(formatted).toContain('User: Tell me about the Italmagneti project');
    expect(formatted).toContain('Assistant: I found some events related to Italmagneti');
    expect(formatted).toContain('Current request:');
  });

  test('should handle empty chat history', () => {
    const emptyHistory: any[] = [];

    const formatted = (orchestrator as any).formatChatHistory(emptyHistory);

    expect(formatted).toBe('This is the start of the conversation.');
  });

  test('should handle null/undefined chat history', () => {
    const formatted1 = (orchestrator as any).formatChatHistory(null);
    const formatted2 = (orchestrator as any).formatChatHistory(undefined);

    expect(formatted1).toBe('This is the start of the conversation.');
    expect(formatted2).toBe('This is the start of the conversation.');
  });
});
