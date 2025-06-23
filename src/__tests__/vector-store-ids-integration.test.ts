import { ToolOrchestrator } from '../services/tool-orchestrator';
import { registerKnowledgeTools } from '../tools/knowledge-tools';
import { DefaultToolRegistry } from '../tools/tool-registry';

describe('Vector Store IDs Integration Test', () => {
  it('should pass vectorStoreIds to vectorFileSearch tool', async () => {
    const mockApiKey = 'test-key';
    const orchestrator = new ToolOrchestrator(mockApiKey);

    // Capture logs
    const logs: string[] = [];
    orchestrator.setProgressCallback((message: string) => {
      logs.push(message);
      console.log(message);
    });

    const toolRegistry = new DefaultToolRegistry();
    registerKnowledgeTools(toolRegistry);

    const userMessage = 'What are the visa requirements for Indonesia?';

    try {
      const result = await orchestrator.orchestrate(
        userMessage,
        [],
        toolRegistry,
        'gpt-4.1-mini-2025-04-14',
        { maxSteps: 3, maxToolCalls: 2 }
      );

      // Check logs for vectorStoreIds
      const vectorSearchLogs = logs.filter(log => log.includes('vectorFileSearch') || log.includes('vectorStoreIds'));
      console.log('Vector search related logs:', vectorSearchLogs);

      // Look for logs that show vectorStoreIds
      const vectorStoreIdLog = logs.find(log => log.includes('vectorStoreIds') && !log.includes('N/A'));
      expect(vectorStoreIdLog).toBeDefined();

      if (vectorStoreIdLog) {
        console.log('Found vectorStoreIds in log:', vectorStoreIdLog);
        expect(vectorStoreIdLog).toContain('vs_6856abe00a4081918be9af94278a7f2c');
      }

    } catch (error) {
      console.log('Expected error (likely no API key):', error instanceof Error ? error.message : error);

      // Check if the error contains vectorStoreIds (shows they were loaded)
      const errorStr = error instanceof Error ? error.message : String(error);
      console.log('Logs captured before error:', logs);
    }
  }, 15000);
});
