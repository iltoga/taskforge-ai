/**
 * @jest-environment node
 */

/**
 * Functional test for agentic mode with calendar tools
 * Tests the complete agentic workflow: user query → orchestrator → tools → simplified events → AI summary
 */

import { CalendarService } from '../../services/calendar-service';
import { ToolOrchestrator } from '../../services/tool-orchestrator';
import { CalendarTools } from '../../tools/calendar-tools';
import { createToolRegistry } from '../../tools/tool-registry';
import { EventList, SimplifiedEvent } from '../../types/calendar';

// Mock CalendarService
const mockCalendarService = {
  getEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as unknown as jest.Mocked<CalendarService>;

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

describe('Agentic Mode - Nespola Events Summary', () => {
  let orchestrator: ToolOrchestrator;
  let calendarTools: CalendarTools;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup calendar tools with mock service
    calendarTools = new CalendarTools(mockCalendarService);

    // Create orchestrator
    orchestrator = new ToolOrchestrator('test-api-key');

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  test('should use agentic mode to summarize Nespola events with simplified data', async () => {
    // Mock verbose Google Calendar API response (what the service returns)
    const mockVerboseCalendarEvents: EventList = {
      items: [
        {
          id: '7174t3r25b1die84e49jn7roa8',
          summary: 'Nespola Meeting',
          description: 'Project discussion with Nespola team',
          start: { dateTime: '2025-03-15T16:00:00+08:00' },
          end: { dateTime: '2025-03-15T17:00:00+08:00' },
          location: 'Conference Room A',
          attendees: [
            { email: 'user1@example.com', displayName: 'User One' },
            { email: 'user2@example.com', displayName: 'User Two' }
          ],
          status: 'confirmed' as const,
          // Verbose metadata that should be filtered out
          htmlLink: 'https://www.google.com/calendar/event?eid=...',
        },
        {
          id: '4dg6ofl23bf8j4msd7cbb18fmp',
          summary: 'daily report - nespola',
          description: '<ul><li>creato assistente per correggere errori del book generator</li><li>aggiornati assistenti per creare outline</li></ul>',
          start: { date: '2025-05-10' },
          end: { date: '2025-05-11' },
          status: 'confirmed' as const,
        },
        {
          id: 'other-meeting-id',
          summary: 'Regular Team Meeting',
          description: 'Weekly team sync',
          start: { dateTime: '2025-04-20T10:00:00+08:00' },
          end: { dateTime: '2025-04-20T11:00:00+08:00' },
          status: 'confirmed' as const,
        }
      ]
    };

    // Mock the calendar service to return verbose events
    mockCalendarService.getEvents.mockResolvedValue(mockVerboseCalendarEvents);

    // Create tool registry with real calendar tools
    const registry = createToolRegistry(calendarTools);

    // Mock orchestrator responses for agentic workflow
    mockGenerateText
      // Step 1: Analysis phase
      .mockResolvedValueOnce({
        text: `## 1. REQUEST DECOMPOSITION
Primary objective: Find and summarize calendar events related to "Nespola" between March and June 2025
Required information:
- Events containing "Nespola" keyword
- Events within specified date range (March-June 2025)
- Event details for summarization

## 2. TOOL STRATEGY
Calendar tools are most relevant for this request
Specific tools needed: searchEvents (to find Nespola-related events with date filtering)
Optimal sequence: Single searchEvents call with query="nespola" and date range

## 3. INFORMATION REQUIREMENTS
Direct answers: List of Nespola events in time range
Context needed: Event titles, descriptions, dates for comprehensive summary
Validation data: Confirmation that all relevant events are found

## 4. APPROACH PLAN
Initial information gathering: Call searchEvents with "nespola" query and March-June 2025 date range
Decision points: Check if results contain relevant events
Expected deliverable: Detailed summary of all Nespola-related activities

## 5. COMPLEXITY ASSESSMENT
Moderate (single tool call with filtering and summarization)`
      })
      // Step 2: Tool decision
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "searchEvents",
    "parameters": {
      "query": "nespola",
      "timeRange": {
        "start": "2025-03-01T00:00:00+08:00",
        "end": "2025-06-30T23:59:59+08:00"
      }
    },
    "reasoning": "Search for events containing 'nespola' within the specified March-June 2025 timeframe to gather all relevant activities for summarization"
  }
]
\`\`\``
      })
      // Step 3: Evaluation after tool call
      .mockResolvedValueOnce({
        text: `\`\`\`
COMPLETE: Successfully retrieved 2 Nespola-related events within the March-June 2025 timeframe. The simplified event data provides sufficient information (titles, descriptions, dates, locations) to create a comprehensive summary of Nespola activities during this period.
\`\`\``
      })
      // Step 4: Final summary generation
      .mockResolvedValueOnce({
        text: `# Nespola Events Summary (March - June 2025)

I found **2 events** related to Nespola between March and June 2025:

## 📅 Events Overview

### 1. Nespola Meeting
- **Date:** March 15, 2025 at 4:00 PM - 5:00 PM
- **Location:** Conference Room A
- **Attendees:** 2 people
- **Description:** Project discussion with Nespola team
- **Type:** Scheduled meeting

### 2. Daily Report - Nespola
- **Date:** May 10, 2025 (All day)
- **Description:** Work activities including:
  - Created assistant for book generator error correction
  - Updated assistants for outline creation
- **Type:** Work log/daily report

## 📊 Summary
During this 4-month period, there were 2 distinct Nespola-related activities:
- **1 project meeting** for team collaboration and discussion
- **1 daily work report** documenting development activities including AI assistant improvements

The activities show ongoing project development work with focus on AI-powered tools and team collaboration.`
      })
      // Step 5: Format validation
      .mockResolvedValueOnce({
        text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request with appropriate format and content structure.'
      });

    // Execute the agentic orchestration
    const result = await orchestrator.orchestrate(
      'summarize all events for nespola between march and june 2025',
      [], // empty chat history
      registry,
      'gpt-4o-mini',
      {
        developmentMode: true,
        maxSteps: 10
      }
    );

    // Verify orchestration was successful
    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(1);

    // Verify the correct tool was called
    const toolCall = result.toolCalls[0];
    expect(toolCall.tool).toBe('searchEvents');
    expect(toolCall.parameters).toEqual({
      query: 'nespola',
      timeRange: {
        start: '2025-03-01T00:00:00+08:00',
        end: '2025-06-30T23:59:59+08:00'
      }
    });

    // Verify tool execution was successful
    expect(toolCall.result.success).toBe(true);

    // Verify the tool returned simplified events (not verbose Google Calendar objects)
    const simplifiedEvents = toolCall.result.data as SimplifiedEvent[];
    expect(simplifiedEvents).toHaveLength(2);

    // Verify simplified event structure contains only essential data
    const firstEvent = simplifiedEvents[0];
    expect(firstEvent).toEqual({
      id: '7174t3r25b1die84e49jn7roa8',
      title: 'Nespola Meeting',
      description: 'Project discussion with Nespola team',
      startDate: '2025-03-15T16:00:00+08:00',
      endDate: '2025-03-15T17:00:00+08:00',
      isAllDay: false,
      location: 'Conference Room A',
      attendeeCount: 2,
      status: 'confirmed'
    });

    const secondEvent = simplifiedEvents[1];
    expect(secondEvent).toEqual({
      id: '4dg6ofl23bf8j4msd7cbb18fmp',
      title: 'daily report - nespola',
      description: '<ul><li>creato assistente per correggere errori del book generator</li><li>aggiornati assistenti per creare outline</li></ul>',
      startDate: '2025-05-10',
      endDate: '2025-05-11',
      isAllDay: true,
      location: undefined,
      attendeeCount: undefined,
      status: 'confirmed'
    });

    // Verify that verbose Google Calendar fields are NOT included
    expect(firstEvent).not.toHaveProperty('htmlLink');
    expect(firstEvent).not.toHaveProperty('attendees');
    expect(firstEvent).not.toHaveProperty('summary');

    // Verify calendar service was called correctly
    expect(mockCalendarService.getEvents).toHaveBeenCalledWith(
      '2025-03-01T00:00:00+08:00',  // start
      '2025-06-30T23:59:59+08:00',  // end
      100,                          // maxResults
      'nespola',                    // query (Google API search)
      false,                        // showDeleted
      'startTime'                   // orderBy
    );

    // Verify final summary includes key information
    expect(result.finalAnswer).toContain('2 events');
    expect(result.finalAnswer).toContain('Nespola Meeting');
    expect(result.finalAnswer).toContain('Daily Report - Nespola'); // Use the title case as it appears in the mock response
    expect(result.finalAnswer).toContain('March 15, 2025');
    expect(result.finalAnswer).toContain('May 10, 2025');

    // Verify development mode captured all steps
    expect(result.steps).toHaveLength(6);
    expect(result.steps[0].type).toBe('analysis');
    expect(result.steps[1].type).toBe('evaluation'); // tool decision step
    expect(result.steps[2].type).toBe('tool_call');  // actual tool execution
    expect(result.steps[3].type).toBe('evaluation'); // progress evaluation
    expect(result.steps[4].type).toBe('synthesis');
    expect(result.steps[5].type).toBe('evaluation'); // format validation

    console.log('✅ Agentic mode successfully:');
    console.log('  - Used searchEvents tool with proper parameters');
    console.log('  - Returned simplified events (not verbose Google Calendar objects)');
    console.log('  - Filtered to only Nespola-related events (2 out of 3 total)');
    console.log('  - Generated comprehensive summary with essential details');
    console.log('  - Completed full agentic workflow with analysis → planning → execution → evaluation → synthesis → format validation');
  });

  test('should handle date range filtering correctly', async () => {
    // Mock events with some outside the date range
    const mockEvents: EventList = {
      items: [
        {
          id: '1',
          summary: 'Nespola Meeting - February',
          start: { dateTime: '2025-02-15T14:00:00+08:00' },
          end: { dateTime: '2025-02-15T15:00:00+08:00' },
          status: 'confirmed' as const,
        },
        {
          id: '2',
          summary: 'Nespola Meeting - April',
          start: { dateTime: '2025-04-15T14:00:00+08:00' },
          end: { dateTime: '2025-04-15T15:00:00+08:00' },
          status: 'confirmed' as const,
        },
        {
          id: '3',
          summary: 'Nespola Meeting - July',
          start: { dateTime: '2025-07-15T14:00:00+08:00' },
          end: { dateTime: '2025-07-15T15:00:00+08:00' },
          status: 'confirmed' as const,
        }
      ]
    };

    mockCalendarService.getEvents.mockResolvedValue(mockEvents);

    const registry = createToolRegistry(calendarTools);

    // Mock responses for simpler test
    mockGenerateText
      .mockResolvedValueOnce({ text: 'Analysis phase' })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "searchEvents",
    "parameters": {
      "query": "nespola",
      "timeRange": {
        "start": "2025-03-01",
        "end": "2025-06-30"
      }
    }
  }
]
\`\`\``
      })
      .mockResolvedValueOnce({ text: 'COMPLETE: Found 1 event in range' })
      .mockResolvedValueOnce({ text: 'Found 1 Nespola event in March-June 2025' })
      .mockResolvedValueOnce({ text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request.' });

    const result = await orchestrator.orchestrate(
      'find nespola events march to june 2025',
      [], // empty chat history
      registry,
      'gpt-4o-mini'
    );

    expect(result.success).toBe(true);

    // Should filter to only the April event (within March-June range)
    const events = result.toolCalls[0].result.data as SimplifiedEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Nespola Meeting - April');

    console.log('✅ Date range filtering works correctly - filtered to 1 event within range');
  });

  test('should handle no results gracefully', async () => {
    // Mock empty calendar response
    mockCalendarService.getEvents.mockResolvedValue({ items: [] });

    const registry = createToolRegistry(calendarTools);

    mockGenerateText
      .mockResolvedValueOnce({ text: 'Analysis phase' })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[{"name": "searchEvents", "parameters": {"query": "nonexistent"}}]
\`\`\``
      })
      .mockResolvedValueOnce({ text: 'COMPLETE: No events found' })
      .mockResolvedValueOnce({ text: 'No events found matching your criteria.' })
      .mockResolvedValueOnce({ text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request.' });

    const result = await orchestrator.orchestrate(
      'find events for nonexistent',
      [], // empty chat history
      registry,
      'gpt-4o-mini'
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].result.data).toEqual([]);
    expect(result.finalAnswer).toContain('No events found');

    console.log('✅ Empty results handled gracefully');
  });

  test('should handle tool errors in agentic mode', async () => {
    // Mock calendar service error
    mockCalendarService.getEvents.mockRejectedValue(new Error('Calendar API error'));

    const registry = createToolRegistry(calendarTools);

    mockGenerateText
      .mockResolvedValueOnce({ text: 'Analysis phase' })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[{"name": "searchEvents", "parameters": {"query": "test"}}]
\`\`\``
      })
      .mockResolvedValueOnce({ text: 'COMPLETE: Tool failed but can provide error info' })
      .mockResolvedValueOnce({ text: 'Unable to access calendar due to API error.' })
      .mockResolvedValueOnce({ text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request.' });

    const result = await orchestrator.orchestrate(
      'find test events',
      [], // empty chat history
      registry,
      'gpt-4o-mini'
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toContain('Calendar API error');

    console.log('✅ Tool errors handled gracefully in agentic mode');
  });
});
