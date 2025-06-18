/**
 * @jest-environment node
 */
import { config } from 'dotenv';
import { AIService } from '../services/ai-service';
import { CalendarEvent } from '../types/calendar';

// Load environment variables from .env file
config();

describe('Functional Test: OpenRouter Gemini Integration', () => {
  let aiService: AIService;

  beforeAll(() => {
    // Get both API keys from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables. Make sure you have a .env file with OPENAI_API_KEY set.');
    }

    if (!openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY not found in environment variables. Make sure you have a .env file with OPENROUTER_API_KEY set.');
    }

    aiService = new AIService(openaiApiKey);
  });

  it('should successfully use Gemini model via OpenRouter for calendar operations', async () => {
    const userMessage = "create a meeting with John tomorrow at 2pm for project review";

    // Mock existing events context
    const mockExistingEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'Daily Standup',
        description: 'Team standup meeting',
        start: { dateTime: '2025-06-17T09:00:00+08:00' },
        end: { dateTime: '2025-06-17T09:30:00+08:00' }
      }
    ];

    console.log('Testing Gemini model via OpenRouter...');
    console.log('User message:', userMessage);

    // Call the AI service with Gemini model
    const result = await aiService.processMessage(
      userMessage,
      mockExistingEvents,
      'google/gemini-2.0-flash-001'
    );

    console.log('Gemini AI Response:', JSON.stringify(result, null, 2));

    // Validate the AI correctly identified this as a create operation
    expect(result.type).toBe('create');

    // Validate the AI correctly parsed the event details
    expect(result.event).toBeDefined();
    expect(result.event?.summary).toContain('John');
    expect(result.event?.summary).toMatch(/meeting|project review/i);

    // Validate the AI set appropriate date/time (tomorrow at 2pm)
    expect(result.event?.start?.dateTime).toBeDefined();
    if (result.event?.start?.dateTime) {
      const startTime = new Date(result.event.start.dateTime);
      expect(startTime.getHours()).toBe(14); // 2pm = 14:00
    }

    // Validate description mentions project review or related terms (if present)
    if (result.event?.description) {
      expect(result.event.description).toMatch(/project review|project progress|discuss.*project/i);
    } else {
      // If no description, at least the summary should indicate it's about project review
      expect(result.event?.summary).toMatch(/project.*review|review.*project/i);
    }

    console.log('✅ Gemini model successfully processed calendar request via OpenRouter');
  }, 30000); // 30 second timeout for API call

  it('should handle translation with Gemini model', async () => {
    const italianMessage = "crea un meeting domani alle 15:00 con Maria per discutere il progetto";

    console.log('Testing Gemini translation capability...');
    console.log('Italian message:', italianMessage);

    // Test translation capability
    const translatedMessage = await aiService.translateToEnglish(
      italianMessage,
      'google/gemini-2.0-flash-001'
    );

    console.log('Gemini translation:', translatedMessage);

    // Validate translation contains key elements
    expect(translatedMessage.toLowerCase()).toMatch(/meeting|meet/);
    expect(translatedMessage.toLowerCase()).toContain('maria');
    expect(translatedMessage.toLowerCase()).toMatch(/tomorrow|15:00|3.*pm/);
    expect(translatedMessage.toLowerCase()).toMatch(/project|discuss/);

    console.log('✅ Gemini model successfully translated Italian to English');
  }, 30000);

  it('should generate weekly report with Gemini model', async () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'Project Planning',
        description: 'Planned new features for Q2',
        start: { date: '2025-06-16' },
        end: { date: '2025-06-16' }
      },
      {
        id: '2',
        summary: 'Code Review',
        description: 'Reviewed pull requests and provided feedback',
        start: { date: '2025-06-17' },
        end: { date: '2025-06-17' }
      },
      {
        id: '3',
        summary: 'Client Meeting',
        description: 'Discussed project requirements with client',
        start: { date: '2025-06-18' },
        end: { date: '2025-06-18' }
      }
    ];

    console.log('Testing Gemini weekly report generation...');

    const report = await aiService.generateWeeklyReport(
      mockEvents,
      'TechCorp',
      '2025-06-16',
      '2025-06-18',
      'google/gemini-2.0-flash-001'
    );

    console.log('Gemini Weekly Report:', report);

    // Validate report contains expected elements
    expect(report).toContain('TechCorp');
    expect(report).toMatch(/2025[\-\/]06[\-\/]16/); // Flexible date format matching
    expect(report).toMatch(/2025[\-\/]06[\-\/]18/); // Flexible date format matching
    expect(report.toLowerCase()).toMatch(/project|planning/);
    expect(report.toLowerCase()).toMatch(/code review|review/);
    expect(report.toLowerCase()).toMatch(/client|meeting/);
    expect(report.toLowerCase()).toMatch(/summary|worklog/);

    // Validate report has proper structure
    expect(report).toMatch(/\*\*.*\*\*/); // Should contain bold formatting
    expect(report.length).toBeGreaterThan(100); // Should be a substantial report

    console.log('✅ Gemini model successfully generated weekly report');
  }, 30000);

  it('should handle complex calendar queries with Gemini model', async () => {
    const complexMessage = "list all meetings next week that are related to development or coding and show only those scheduled in the afternoon";

    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'Development Review',
        description: 'Code review and development planning',
        start: { dateTime: '2025-06-23T14:00:00+08:00' },
        end: { dateTime: '2025-06-23T15:00:00+08:00' }
      },
      {
        id: '2',
        summary: 'Marketing Meeting',
        description: 'Discuss marketing strategy',
        start: { dateTime: '2025-06-24T10:00:00+08:00' },
        end: { dateTime: '2025-06-24T11:00:00+08:00' }
      }
    ];

    console.log('Testing Gemini complex query processing...');

    const result = await aiService.processMessage(
      complexMessage,
      mockEvents,
      'google/gemini-2.0-flash-001'
    );

    console.log('Gemini Complex Query Result:', JSON.stringify(result, null, 2));

    // Validate the AI correctly identified this as a list operation
    expect(result.type).toBe('list');

    // Validate the AI set appropriate time range for "next week"
    expect(result.timeRange).toBeDefined();
    expect(result.timeRange?.start).toBeDefined();
    expect(result.timeRange?.end).toBeDefined();

    // The query should be asking for next week's events
    if (result.timeRange?.start) {
      const startDate = new Date(result.timeRange.start);
      const now = new Date();
      expect(startDate.getTime()).toBeGreaterThan(now.getTime());
    }

    console.log('✅ Gemini model successfully processed complex calendar query');
  }, 30000);
});
