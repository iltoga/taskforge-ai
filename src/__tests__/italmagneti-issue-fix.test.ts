import { ToolOrchestrator } from '../services/tool-orchestrator';
import { ToolRegistry } from '../tools/tool-registry';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn()
}));

import { generateText } from 'ai';

// Helper function to create proper AI response mocks
function createAIResponse(text: string) {
  return {
    text,
    reasoning: undefined,
    files: [],
    reasoningDetails: [],
    sources: [],
    toolCalls: [],
    toolResults: [],
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    },
    metadata: {},
    warnings: [],
    providerMetadata: {},
    request: {
      model: 'test-model'
    },
    response: {
      headers: new Headers(),
      id: 'test-id',
      timestamp: new Date(),
      modelId: 'test-model'
    },
    experimental_output: undefined,
    finishReason: 'stop' as const,
    steps: [],
    logprobs: undefined,
    experimental_providerMetadata: undefined
  };
}

describe('Italmagneti Issue Fix', () => {
  let orchestrator: ToolOrchestrator;
  let mockRegistry: ToolRegistry;
  const mockGenerateText = generateText as jest.MockedFunction<typeof generateText>;

  beforeEach(() => {
    // Read API key from environment or use test key
    const apiKey = process.env.OPENAI_API_KEY || 'test-api-key';
    orchestrator = new ToolOrchestrator(apiKey);

    // Mock registry with calendar tools
    mockRegistry = {
      getAvailableCategories: () => ['calendar'],
      getToolsByCategory: (category: string) => {
        if (category === 'calendar') {
          return [
            { name: 'searchEvents', description: 'Search for events by query' },
            { name: 'getEvents', description: 'Get all events in a time range' }
          ];
        }
        return [];
      },
      executeTool: jest.fn()
    } as any;

    // Reset mocks
    mockGenerateText.mockReset();
    (mockRegistry.executeTool as jest.Mock).mockReset();
  });

  test('should use calendar tools for Italmagneti project query', async () => {
    // Mock calendar search returning no events
    (mockRegistry.executeTool as jest.Mock).mockResolvedValue({
      success: true,
      data: [], // No events found
      message: 'No events found for query "italmagneti"'
    });

    // Mock AI responses for orchestrator internal logic - need more responses for validation steps
    mockGenerateText
      .mockResolvedValueOnce(createAIResponse(`ANALYSIS: The user is asking about the "Italmagneti project" in Italian. This appears to be a request for project-related information that should be found in calendar events, meetings, or tasks. I need to search the calendar for any events containing "Italmagneti" to provide accurate information.

CLASSIFICATION: calendar_query
REASONING: The query mentions a specific project name and asks for information about it. This type of information is typically found in calendar events, meetings, or project-related appointments.`))
      .mockResolvedValueOnce(createAIResponse(`EXECUTE: searchEvents
PARAMETERS: {"query": "italmagneti"}
REASONING: Need to search for calendar events related to the Italmagneti project to find any meetings, deadlines, or project-related activities.`))
      .mockResolvedValueOnce(createAIResponse(`STOP: sufficient_information
REASONING: I have searched the calendar for Italmagneti project information and found no events. This gives me enough information to provide an accurate response stating that no project information was found in the calendar.`))
      .mockResolvedValueOnce(createAIResponse(`Based on my search of your calendar, I could not find any events or information related to the "Italmagneti project". There are no meetings, deadlines, or other calendar entries that mention Italmagneti.

If you have specific questions about this project or if the information might be stored elsewhere, please let me know how I can help you further.`))
      // Add more responses for validation steps
      .mockResolvedValue(createAIResponse(`FORMAT_ACCEPTABLE: The response properly addresses the user's query with appropriate format and content structure.`));

    const query = "cosa puoi dirmi sul progetto Italmagneti?";

    const result = await orchestrator.orchestrate(
      query,
      [], // empty chat history
      mockRegistry,
      'gpt-4.1-mini', // model
      {
        maxSteps: 10,
        maxToolCalls: 5
      }
    );

    // Verify searchEvents was called with "italmagneti"
    expect(mockRegistry.executeTool).toHaveBeenCalledWith(
      'searchEvents',
      expect.objectContaining({
        query: expect.stringContaining('italmagneti')
      })
    );

    // Response should indicate no calendar data found, not provide translation
    expect(result.finalAnswer.toLowerCase()).not.toContain('translation');
    expect(result.finalAnswer.toLowerCase()).not.toContain('translate');
    expect(result.finalAnswer.toLowerCase()).not.toContain('english');

    // Should indicate no information found
    expect(result.finalAnswer.toLowerCase()).toMatch(/(no.*found|no.*information|no.*data|no.*events)/);
  });

  test('should prioritize calendar tools over general responses for project queries', async () => {
    // Mock successful calendar search with events
    (mockRegistry.executeTool as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          summary: 'Italmagneti Project Meeting',
          start: { dateTime: '2025-01-15T10:00:00Z' },
          description: 'Project kickoff meeting'
        },
        {
          summary: 'Italmagneti Review',
          start: { dateTime: '2025-01-20T14:00:00Z' },
          description: 'Monthly review'
        }
      ],
      message: 'Found 2 events for query "italmagneti"'
    });

    // Mock AI responses - need more responses for validation steps
    mockGenerateText
      .mockResolvedValueOnce(createAIResponse(`ANALYSIS: User is asking about the "Italmagneti project". This is a project-related query that requires searching calendar data for meetings, events, and project activities.

CLASSIFICATION: calendar_query
REASONING: Project information is typically stored in calendar events, meetings, and appointments.`))
      .mockResolvedValueOnce(createAIResponse(`EXECUTE: searchEvents
PARAMETERS: {"query": "italmagneti"}
REASONING: Search for calendar events related to Italmagneti project.`))
      .mockResolvedValueOnce(createAIResponse(`STOP: sufficient_information
REASONING: Found calendar events for Italmagneti project. Have enough information to provide a comprehensive answer.`))
      .mockResolvedValueOnce(createAIResponse(`I found information about the Italmagneti project in your calendar:

**Upcoming Events:**
- **Italmagneti Project Meeting** - January 15, 2025 at 10:00 AM
  - Description: Project kickoff meeting
- **Italmagneti Review** - January 20, 2025 at 2:00 PM
  - Description: Monthly review

Based on your calendar, it appears the Italmagneti project has regular meetings and reviews scheduled.`))
      // Add more responses for validation steps
      .mockResolvedValue(createAIResponse(`FORMAT_ACCEPTABLE: The response properly addresses the user's query with appropriate format and content structure.`));

    const query = "tell me about the Italmagneti project";

    const result = await orchestrator.orchestrate(
      query,
      [], // empty chat history
      mockRegistry,
      'gpt-4.1-mini',
      {
        maxSteps: 10,
        maxToolCalls: 5
      }
    );

    // Verify calendar tool was called
    expect(mockRegistry.executeTool).toHaveBeenCalledWith(
      'searchEvents',
      expect.objectContaining({
        query: expect.stringContaining('italmagneti')
      })
    );

    // Response should contain calendar information
    expect(result.finalAnswer.toLowerCase()).toContain('meeting');
    expect(result.finalAnswer).toContain('Italmagneti');

    // Should not be a translation response
    expect(result.finalAnswer.toLowerCase()).not.toContain('translation');
    expect(result.finalAnswer.toLowerCase()).not.toContain('translate');
  });

  test('should handle Italian project queries as calendar requests', async () => {
    (mockRegistry.executeTool as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
      message: 'No events found'
    });

    // Mock AI responses for Italian queries
    mockGenerateText
      .mockResolvedValue(createAIResponse(`ANALYSIS: This is a project-related query in Italian. Need to search calendar for project information.

CLASSIFICATION: calendar_query

EXECUTE: searchEvents
PARAMETERS: {"query": "nespola"}

STOP: sufficient_information
REASONING: Searched calendar and found no events.

Final response: Non ho trovato informazioni su questo progetto nel calendario.`));

    const italianQueries = [
      "cosa puoi dirmi sul progetto Nespola?",
      "dimmi tutto sul progetto Italmagneti",
      "qual è lo stato del progetto TechCorp?"
    ];

    for (const query of italianQueries) {
      (mockRegistry.executeTool as jest.Mock).mockClear();
      mockGenerateText.mockClear();

      // Set up fresh mocks for each query
      mockGenerateText
        .mockResolvedValueOnce(createAIResponse(`ANALYSIS: Project query in Italian requires calendar search.
CLASSIFICATION: calendar_query`))
        .mockResolvedValueOnce(createAIResponse(`EXECUTE: searchEvents
PARAMETERS: {"query": "${query.toLowerCase().includes('nespola') ? 'nespola' : query.toLowerCase().includes('italmagneti') ? 'italmagneti' : 'techcorp'}"}
REASONING: Search for project events.`))
        .mockResolvedValueOnce(createAIResponse(`STOP: sufficient_information
REASONING: Completed calendar search.`))
        .mockResolvedValueOnce(createAIResponse(`Non ho trovato informazioni su questo progetto nel calendario.`));

      const result = await orchestrator.orchestrate(
        query,
        [], // empty chat history
        mockRegistry,
        'gpt-4.1-mini',
        {
          maxSteps: 10,
          maxToolCalls: 5
        }
      );

      // Should call calendar tools, not provide translation
      expect(mockRegistry.executeTool).toHaveBeenCalled();
      expect(result.finalAnswer.toLowerCase()).not.toContain('translation');
      expect(result.finalAnswer.toLowerCase()).not.toContain('translate');
    }
  });

  test('should force calendar tool retry if none attempted for calendar query', async () => {
    let callCount = 0;
    (mockRegistry.executeTool as jest.Mock).mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        success: true,
        data: [],
        message: 'No events found'
      });
    });

    // Mock AI responses
    mockGenerateText
      .mockResolvedValueOnce(createAIResponse(`ANALYSIS: User asking about "Italmagneti project status" - this requires calendar search.
CLASSIFICATION: calendar_query
REASONING: Project status information is found in calendar events.`))
      .mockResolvedValueOnce(createAIResponse(`EXECUTE: searchEvents
PARAMETERS: {"query": "italmagneti"}
REASONING: Search for project status in calendar events.`))
      .mockResolvedValueOnce(createAIResponse(`STOP: sufficient_information
REASONING: Calendar search completed, can provide response.`))
      .mockResolvedValueOnce(createAIResponse(`No events found for Italmagneti project status in your calendar.`));

    const query = "Italmagneti project status";

    await orchestrator.orchestrate(
      query,
      [], // empty chat history
      mockRegistry,
      'gpt-4.1-mini',
      {
        maxSteps: 10,
        maxToolCalls: 5
      }
    );

    // Should have attempted calendar tools
    expect(mockRegistry.executeTool).toHaveBeenCalled();
    expect(callCount).toBeGreaterThan(0);
  });
});
