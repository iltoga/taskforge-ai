import { z } from 'zod';
import { CalendarService } from '../services/calendar-service';
import { ToolOrchestrator } from '../services/tool-orchestrator';
import { CalendarTools } from '../tools/calendar-tools';
import { DefaultToolRegistry } from '../tools/tool-registry';

// Mock CalendarService
const mockCalendarService = {
  listEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as unknown as CalendarService;

// Mock OpenAI API
const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: (params: unknown) => mockGenerateText(params),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({
    languageModel: jest.fn(() => 'mock-model'),
  })),
}));

describe('Enhanced Tool Orchestrator', () => {
  let orchestrator: ToolOrchestrator;
  let registry: DefaultToolRegistry;
  let calendarTools: CalendarTools;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup
    calendarTools = new CalendarTools(mockCalendarService);
    registry = new DefaultToolRegistry();
    orchestrator = new ToolOrchestrator('test-api-key');

    // Register a simple calendar tool with proper Zod schema
    registry.registerTool(
      {
        name: 'getEvents',
        description: 'Get calendar events',
        parameters: z.object({
          timeRange: z.object({
            start: z.string().optional(),
            end: z.string().optional(),
          }).optional()
        }),
        category: 'calendar'
      },
      async () => ({
        success: true,
        data: [
          { id: '1', summary: 'Test Meeting', start: { dateTime: '2024-06-15T14:00:00Z' } },
          { id: '2', summary: 'Nespola Review', start: { dateTime: '2024-06-16T15:00:00Z' } }
        ],
        message: 'Retrieved 2 events'
      })
    );
  });

  it('should perform comprehensive analysis with enhanced prompting', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: `## 1. REQUEST DECOMPOSITION
Primary objective: Find calendar events
Required information: Events from specific time period
Potential sub-tasks: Query calendar API with date filters

## 2. TOOL STRATEGY
Calendar tools are most relevant
Specific tools needed: getEvents
Optimal sequence: Single call with time range

## 3. INFORMATION REQUIREMENTS
Direct answers: List of events in time range
Context needed: Event details and timing
Validation data: Confirmation of results

## 4. APPROACH PLAN
Initial information gathering: Call getEvents
Decision points: Check if results are complete
Contingency plans: Retry with different parameters
Expected deliverable: Formatted list of events

## 5. COMPLEXITY ASSESSMENT
Simple (single tool call)`
      })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "getEvents",
    "parameters": {},
    "reasoning": "Need to retrieve calendar events to answer user's request"
  }
]
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `\`\`\`
COMPLETE: We have successfully retrieved the calendar events. The results show 2 events which provides sufficient information to answer the user's request comprehensively.
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `# Your Calendar Events

I found 2 events in your calendar:

## 📅 Test Meeting
**Time:** June 15, 2024 at 2:00 PM
**ID:** 1

## 📅 Nespola Review
**Time:** June 16, 2024 at 3:00 PM
**ID:** 2

Both events are properly scheduled and ready for your reference.`
      });

    const result = await orchestrator.orchestrate(
      'Show me my calendar events',
      registry,
      'gpt-4o-mini',
      { developmentMode: true }
    );

    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(4); // Allow for extra steps
    expect(result.toolCalls).toHaveLength(1);
    expect(result.finalAnswer).toContain('2 events');

    // Verify enhanced analysis step
    const analysisStep = result.steps.find(step => step.type === 'analysis');
    expect(analysisStep).toBeDefined();
    expect(analysisStep!.content).toContain('REQUEST DECOMPOSITION');
    expect(analysisStep!.content).toContain('TOOL STRATEGY');
    expect(analysisStep!.content).toContain('COMPLEXITY ASSESSMENT');
  });

  it('should handle multi-step reasoning with iterative tool calls', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: `## 1. REQUEST DECOMPOSITION
Primary objective: Create and verify calendar event
Required information: Event creation confirmation and details
Potential sub-tasks: Create event, then verify it was created

## 2. TOOL STRATEGY
Calendar tools needed for creation and verification
Specific tools: createEvent, then getEvents
Optimal sequence: Create first, then list to verify

## 3. APPROACH PLAN
Two-step process with verification`
      })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "createEvent",
    "parameters": {
      "eventData": {
        "summary": "New Meeting",
        "start": { "dateTime": "2024-06-20T14:00:00Z" },
        "end": { "dateTime": "2024-06-20T15:00:00Z" }
      }
    },
    "reasoning": "First step: create the requested event"
  }
]
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `\`\`\`
CONTINUE: Event was created successfully but we should verify it appears in the calendar to provide complete confirmation to the user.
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "getEvents",
    "parameters": {},
    "reasoning": "Verify the created event appears in the calendar"
  }
]
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `\`\`\`
COMPLETE: We have successfully created the event and verified it appears in the calendar. This provides complete confirmation of the action.
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `✅ **Event Created Successfully!**

I've created your new meeting and verified it's in your calendar:

## 📅 New Meeting
**Time:** June 20, 2024 at 2:00 PM - 3:00 PM
**Status:** ✅ Confirmed in calendar

The event has been successfully added and is ready for you.`
      });

    // Add createEvent tool to registry with proper schema
    registry.registerTool(
      {
        name: 'createEvent',
        description: 'Create a new calendar event',
        parameters: z.object({
          eventData: z.object({
            summary: z.string(),
            start: z.object({
              dateTime: z.string().optional(),
              date: z.string().optional(),
            }),
            end: z.object({
              dateTime: z.string().optional(),
              date: z.string().optional(),
            }),
          })
        }),
        category: 'calendar'
      },
      async () => ({
        success: true,
        data: { id: 'new-event-123', summary: 'New Meeting' },
        message: 'Event created successfully'
      })
    );

    const result = await orchestrator.orchestrate(
      'Create a meeting called "New Meeting" for tomorrow at 2pm and verify it was created',
      registry,
      'gpt-4o-mini',
      { developmentMode: true }
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(2); // create + verify
    expect(result.steps.length).toBeGreaterThanOrEqual(6); // Allow for extra steps
    expect(result.finalAnswer).toContain('Event Created Successfully');
  });

  it('should handle tool failures gracefully with detailed error information', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: `## 1. REQUEST DECOMPOSITION
Primary objective: Retrieve calendar events
Required information: Events from calendar
Potential sub-tasks: Query calendar API

## 2. TOOL STRATEGY
Calendar tools required
Specific tools: getEvents`
      })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "getEvents",
    "parameters": {},
    "reasoning": "Retrieve calendar events as requested"
  }
]
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `\`\`\`
COMPLETE: Although the tool call failed, we have enough information to provide a helpful error message to the user explaining what went wrong.
\`\`\``
      })
      .mockResolvedValueOnce({
        text: `❌ **Unable to Retrieve Calendar Events**

I encountered an issue while trying to access your calendar:

**Error Details:**
- **Tool:** getEvents (875ms) ❌ FAILED
- **Issue:** API rate limit exceeded
- **Message:** Please try again in a few minutes

**Suggested Solution:**
Please wait a few minutes and try your request again. Calendar API limits help ensure reliable service for all users.`
      });

    // Override the getEvents tool to fail
    registry.registerTool(
      {
        name: 'getEvents',
        description: 'Get calendar events (will fail)',
        parameters: z.object({
          timeRange: z.object({
            start: z.string().optional(),
            end: z.string().optional(),
          }).optional()
        }),
        category: 'calendar'
      },
      async () => ({
        success: false,
        error: 'API rate limit exceeded',
        message: 'Please try again in a few minutes'
      })
    );

    const result = await orchestrator.orchestrate(
      'Show me my events',
      registry,
      'gpt-4o-mini',
      { developmentMode: true }
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.finalAnswer).toContain('Unable to Retrieve Calendar Events');
    expect(result.finalAnswer).toContain('API rate limit exceeded');
  });

  it('should parse tool decisions from various formats', async () => {
    const testCases = [
      // JSON with code blocks
      `\`\`\`json
CALL_TOOLS:
[{"name": "test", "parameters": {}}]
\`\`\``,

      // JSON without code blocks
      `CALL_TOOLS:
[{"name": "test", "parameters": {}}]`,

      // Just JSON array
      `[{"name": "test", "parameters": {}}]`
    ];

    for (const testCase of testCases) {
      const decisions = (orchestrator as any).parseToolDecisions(testCase);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].name).toBe('test');
    }
  });

  it('should correctly evaluate when more information is needed', async () => {
    const testCases = [
      { content: 'CONTINUE: Need more data', expected: true },
      { content: 'COMPLETE: Have sufficient info', expected: false },
      { content: 'We need more information to proceed', expected: true },
      { content: 'We have enough information to answer', expected: false },
      { content: 'The current data is sufficient', expected: false }
    ];

    for (const testCase of testCases) {
      const result = (orchestrator as any).needsMoreInformation(testCase.content);
      expect(result).toBe(testCase.expected);
    }
  });

  it('should include tool categories in analysis phase', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Analysis with tool categories'
    });

    await orchestrator.orchestrate(
      'Test message',
      registry,
      'gpt-4o-mini',
      { maxSteps: 1 }
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('**CALENDAR**:')
          })
        ])
      })
    );
  });
});
