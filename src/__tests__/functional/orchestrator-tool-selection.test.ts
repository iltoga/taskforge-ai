import dotenv from 'dotenv';
import { CalendarService } from '../../services/calendar-service';
import { ToolOrchestrator } from '../../services/tool-orchestrator';
import { CalendarTools } from '../../tools/calendar-tools';
import { EmailTools } from '../../tools/email-tools';
import { FileTools } from '../../tools/file-tools';
import { registerKnowledgeTools } from '../../tools/knowledge-tools';
import { createToolRegistry } from '../../tools/tool-registry';

// Load environment variables
dotenv.config();

describe('Orchestrator Tool Selection', () => {
  let orchestrator: ToolOrchestrator;
  let toolRegistry: any;

  beforeAll(() => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    orchestrator = new ToolOrchestrator(apiKey);

    // Create calendar service mock (access token will be set later if needed)
    const mockAuth = {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
    };
    const calendarService = new CalendarService(mockAuth as never);

    // Create tool instances
    const calendarTools = new CalendarTools(calendarService);
    const emailTools = new EmailTools();
    const fileTools = new FileTools();

    // Create registry without web tools (matching production setup)
    toolRegistry = createToolRegistry(calendarTools, emailTools, fileTools);

    // Register knowledge tools (including vector search)
    registerKnowledgeTools(toolRegistry);
  });

  it('should select vectorFileSearch for knowledge queries instead of web search', async () => {
    const knowledgeQuery = "I am italian, what type of visa to indonesia can I get?";

    const result = await orchestrator.orchestrate(
      knowledgeQuery,
      [], // empty chat history
      toolRegistry,
      'gpt-4.1-mini-2025-04-14',
      { maxSteps: 3, maxToolCalls: 2, developmentMode: true }
    );

    console.log('Orchestration result:', {
      success: result.success,
      toolCalls: result.toolCalls.map(call => ({
        tool: call.tool,
        parameters: call.parameters,
        success: call.result.success
      })),
      finalAnswer: result.finalAnswer.substring(0, 200) + '...'
    });

    // Verify that vector search was used instead of web search
    const toolsUsed = result.toolCalls.map(call => call.tool);
    expect(toolsUsed).toContain('vectorFileSearch');
    expect(toolsUsed).not.toContain('searchWeb');

    // Verify the orchestration was successful
    expect(result.success).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);

    // Verify that vectorFileSearch was actually called
    const vectorSearchCall = result.toolCalls.find(call => call.tool === 'vectorFileSearch');
    expect(vectorSearchCall).toBeDefined();
    expect(vectorSearchCall?.parameters).toHaveProperty('query');

    console.log('✅ Test passed: vectorFileSearch was used for knowledge query');
  }, 30000); // 30 second timeout
});
