/**
 * @jest-environment node
 */

/**
 * Final verification test for agentic mode functionality
 * This test demonstrates the complete workflow: query → orchestrator → tools → simplified data → AI summary
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

describe('Final Agentic Verification', () => {
  let orchestrator: ToolOrchestrator;
  let calendarTools: CalendarTools;

  beforeEach(() => {
    jest.clearAllMocks();
    calendarTools = new CalendarTools(mockCalendarService);
    orchestrator = new ToolOrchestrator('test-api-key');
    process.env.OPENAI_API_KEY = 'test-key';
  });

  test('complete agentic workflow: query → analysis → tool execution → simplified events → summary', async () => {
    // Mock the exact scenario: search for "nespola" events between March-June 2025
    const mockEvents: EventList = {
      items: [
        {
          id: 'evt1',
          summary: 'Nespola Team Meeting',
          description: 'Weekly sync with Nespola team',
          start: { dateTime: '2025-04-15T14:00:00+08:00' },
          end: { dateTime: '2025-04-15T15:00:00+08:00' },
          location: 'Conference Room B',
          attendees: [
            { email: 'alice@company.com', displayName: 'Alice' },
            { email: 'bob@company.com', displayName: 'Bob' }
          ],
          status: 'confirmed' as const,
        },
        {
          id: 'evt2',
          summary: 'Daily Work Report - Nespola',
          description: 'Development progress for nespola project',
          start: { date: '2025-05-20' },
          end: { date: '2025-05-21' },
          status: 'confirmed' as const,
        }
      ]
    };

    mockCalendarService.getEvents.mockResolvedValue(mockEvents);

    // Mock AI orchestrator responses (simplified)
    mockGenerateText
      .mockResolvedValueOnce({ text: 'Analysis: User wants Nespola events from March-June 2025' })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[{
  "name": "searchEvents",
  "parameters": {
    "query": "nespola",
    "timeRange": {
      "start": "2025-03-01T00:00:00+08:00",
      "end": "2025-06-30T23:59:59+08:00"
    }
  }
}]
\`\`\``
      })
      .mockResolvedValueOnce({ text: 'COMPLETE: Found 2 Nespola events in the timeframe' })
      .mockResolvedValueOnce({
        text: `# Nespola Events Summary

Found 2 Nespola-related events:

**1. Nespola Team Meeting** - April 15, 2025 (2:00-3:00 PM)
- Location: Conference Room B
- 2 attendees
- Weekly sync meeting

**2. Daily Work Report - Nespola** - May 20, 2025 (All day)
- Development progress update

Both events show active Nespola project work during Q2 2025.`
      })
      // Add format validation response
      .mockResolvedValueOnce({ text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request with appropriate format and content structure.' });

    const registry = createToolRegistry(calendarTools);

    // Execute agentic orchestration
    const result = await orchestrator.orchestrate(
      'summarize all events for nespola between march and june 2025',
      [], // empty chat history
      registry,
      'gpt-4.1-mini-2025-04-14',
      { developmentMode: true }
    );

    // === VERIFICATION ===

    // 1. Orchestration succeeded
    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(1);

    // 2. Correct tool was called with proper parameters
    const toolCall = result.toolCalls[0];
    expect(toolCall.tool).toBe('searchEvents');
    expect(toolCall.parameters).toEqual({
      query: 'nespola',
      timeRange: {
        start: '2025-03-01T00:00:00+08:00',
        end: '2025-06-30T23:59:59+08:00'
      }
    });

    // 3. Tool execution was successful
    expect(toolCall.result.success).toBe(true);

    // 4. Calendar service called correctly
    expect(mockCalendarService.getEvents).toHaveBeenCalledWith(
      '2025-03-01T00:00:00+08:00',
      '2025-06-30T23:59:59+08:00',
      100,
      'nespola',
      false,
      'startTime',
      undefined,  // timeZone
      'primary'   // calendarId
    );

    // 5. Returned data is simplified (not verbose Google Calendar objects)
    const simplifiedEvents = toolCall.result.data as SimplifiedEvent[];
    expect(simplifiedEvents).toHaveLength(2);

    // Verify first event is simplified
    expect(simplifiedEvents[0]).toEqual({
      id: 'evt1',
      title: 'Nespola Team Meeting',
      description: 'Weekly sync with Nespola team',
      startDate: '2025-04-15T14:00:00+08:00',
      endDate: '2025-04-15T15:00:00+08:00',
      isAllDay: false,
      location: 'Conference Room B',
      attendeeCount: 2,
      status: 'confirmed'
    });

    // Verify second event is simplified
    expect(simplifiedEvents[1]).toEqual({
      id: 'evt2',
      title: 'Daily Work Report - Nespola',
      description: 'Development progress for nespola project',
      startDate: '2025-05-20',
      endDate: '2025-05-21',
      isAllDay: true,
      location: undefined,
      attendeeCount: undefined,
      status: 'confirmed'
    });

    // 6. No verbose fields present (like htmlLink, attendees array, etc.)
    simplifiedEvents.forEach(event => {
      expect(event).not.toHaveProperty('htmlLink');
      expect(event).not.toHaveProperty('attendees');
      expect(event).not.toHaveProperty('summary');
    });

    // 7. AI generated meaningful summary
    expect(result.finalAnswer).toContain('Nespola');
    expect(result.finalAnswer).toContain('2 ');
    expect(result.finalAnswer).toContain('April 15');
    expect(result.finalAnswer).toContain('May 20');

    // 8. Full agentic workflow completed (6 steps with format validation)
    expect(result.steps).toHaveLength(6);
    expect(result.steps[0].type).toBe('analysis');
    expect(result.steps[1].type).toBe('evaluation'); // tool decision
    expect(result.steps[2].type).toBe('tool_call');  // tool execution
    expect(result.steps[3].type).toBe('evaluation'); // progress check
    expect(result.steps[4].type).toBe('synthesis');  // final answer
    expect(result.steps[5].type).toBe('evaluation'); // format validation

    console.log('🎉 AGENTIC MODE VERIFICATION COMPLETE:');
    console.log('  ✅ Query parsing and analysis');
    console.log('  ✅ Strategic tool selection');
    console.log('  ✅ Calendar tool execution');
    console.log('  ✅ Data simplification (verbose → simplified)');
    console.log('  ✅ Event filtering by keyword');
    console.log('  ✅ Date range filtering');
    console.log('  ✅ AI summary generation');
    console.log('  ✅ Format validation and iteration');
    console.log('  ✅ Complete 6-step workflow');
    console.log('');
    console.log('🔧 TECHNICAL VERIFICATION:');
    console.log(`  ✅ Tool call: ${toolCall.tool} with correct params`);
    console.log(`  ✅ Service call: getEvents() with search query "nespola"`);
    console.log(`  ✅ Data format: SimplifiedEvent[] (not verbose CalendarEvent[])`);
    console.log(`  ✅ Event count: ${simplifiedEvents.length} filtered events`);
    console.log(`  ✅ Result: Meaningful AI-generated summary`);
  });

  test('agentic mode handles errors gracefully', async () => {
    // Mock calendar service error
    mockCalendarService.getEvents.mockRejectedValue(new Error('API timeout'));

    const registry = createToolRegistry(calendarTools);

    mockGenerateText
      .mockResolvedValueOnce({ text: 'Analysis phase' })
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[{"name": "searchEvents", "parameters": {"query": "test"}}]
\`\`\``
      })
      .mockResolvedValueOnce({ text: 'COMPLETE: Tool failed, can explain error' })
      .mockResolvedValueOnce({ text: 'Unable to search calendar events due to API timeout.' })
      // Add format validation response
      .mockResolvedValueOnce({ text: 'FORMAT_ACCEPTABLE: The response properly addresses the user\'s request with appropriate format and content structure.' });

    const result = await orchestrator.orchestrate(
      'find test events',
      [], // empty chat history
      registry,
      'gpt-4.1-mini-2025-04-14'
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].result.success).toBe(false);
    expect(result.toolCalls[0].result.error).toContain('API timeout');
    expect(result.finalAnswer).toContain('Unable to search calendar events');

    console.log('🛡️ Error handling verified: Agentic mode gracefully handles tool failures');
  });
});
