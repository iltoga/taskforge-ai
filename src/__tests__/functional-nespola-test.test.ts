/**
 * @jest-environment node
 */
import { config } from 'dotenv';
import { AIService } from '../services/ai-service';
import { CalendarEvent } from '../types/calendar';

// Load environment variables from .env file
config();

describe('Functional Test: Nespola Events Filtering', () => {
  let aiService: AIService;

  beforeAll(() => {
    // Get real API key from environment
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment variables. Make sure you have a .env file with OPENAI_API_KEY set.');
    }

    aiService = new AIService(apiKey);
  });

  it('should correctly parse "list all events relative to nespola from march to june 2025" and return proper timeRange', async () => {
    const userMessage = "list all events relative to nespola from march to june 2025";

    // Mock existing events that include some nespola events and some non-nespola events
    const mockExistingEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'Daily Report - Nespola',
        description: 'Work activities for Nespola project',
        start: { dateTime: '2025-04-15T09:00:00+08:00' },
        end: { dateTime: '2025-04-15T10:00:00+08:00' }
      },
      {
        id: '2',
        summary: 'Meeting with John',
        description: 'General meeting not related to nespola',
        start: { dateTime: '2025-04-16T14:00:00+08:00' },
        end: { dateTime: '2025-04-16T15:00:00+08:00' }
      },
      {
        id: '3',
        summary: 'Nespola Project Review',
        description: 'Review of nespola deliverables',
        start: { dateTime: '2025-05-10T11:00:00+08:00' },
        end: { dateTime: '2025-05-10T12:00:00+08:00' }
      },
      {
        id: '4',
        summary: 'Team Building',
        description: 'Company team building event',
        start: { dateTime: '2025-05-20T10:00:00+08:00' },
        end: { dateTime: '2025-05-20T18:00:00+08:00' }
      },
      {
        id: '5',
        summary: 'Nespola Sprint Planning',
        description: 'Planning session for nespola development',
        start: { dateTime: '2025-06-01T09:00:00+08:00' },
        end: { dateTime: '2025-06-01T10:30:00+08:00' }
      }
    ];

    console.log('Sending message to OpenAI:', userMessage);
    console.log('Using model: gpt-4o-mini');

    // Call the real AI service
    const result = await aiService.processMessage(userMessage, mockExistingEvents, 'gpt-4o-mini');

    console.log('AI Response:', JSON.stringify(result, null, 2));

    // Validate the AI correctly identified this as a list operation
    expect(result.type).toBe('list');

    // Validate the AI correctly parsed the date range
    expect(result.timeRange).toBeDefined();
    expect(result.timeRange?.start).toBe('2025-03-01T00:00:00+08:00');
    expect(result.timeRange?.end).toBe('2025-06-30T23:59:59+08:00');

    // The AI should NOT include event filtering in the response (that's handled by backend)
    expect(result.event).toBeUndefined();
    expect(result.eventId).toBeUndefined();
  }, 30000); // 30 second timeout for API call

  it('should properly handle the filtering logic that would be applied on the backend', () => {
    const userMessage = "list all events relative to nespola from march to june 2025";

    // Simulate the events that would be returned from calendar API
    const allEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'Daily Report - Nespola',
        description: 'Work activities for Nespola project',
        start: { dateTime: '2025-04-15T09:00:00+08:00' },
        end: { dateTime: '2025-04-15T10:00:00+08:00' }
      },
      {
        id: '2',
        summary: 'Meeting with John',
        description: 'General team meeting about other topics',
        start: { dateTime: '2025-04-16T14:00:00+08:00' },
        end: { dateTime: '2025-04-16T15:00:00+08:00' }
      },
      {
        id: '3',
        summary: 'Nespola Project Review',
        description: 'Review of nespola deliverables',
        start: { dateTime: '2025-05-10T11:00:00+08:00' },
        end: { dateTime: '2025-05-10T12:00:00+08:00' }
      },
      {
        id: '4',
        summary: 'Team Building',
        description: 'Company team building event',
        start: { dateTime: '2025-05-20T10:00:00+08:00' },
        end: { dateTime: '2025-05-20T18:00:00+08:00' }
      },
      {
        id: '5',
        summary: 'Nespola Sprint Planning',
        description: 'Planning session for nespola development',
        start: { dateTime: '2025-06-01T09:00:00+08:00' },
        end: { dateTime: '2025-06-01T10:30:00+08:00' }
      }
    ];

    // Extract filter keywords from the message (this simulates what our backend does)
    const messageLower = userMessage.toLowerCase();
    const filterKeywords: string[] = [];

    // Extract "nespola" from patterns like "events relative to nespola"
    const patterns = [
      /(?:for|about|regarding|related to|relative to)\s+([a-zA-Z\-_]+)/gi,
      /(?:activities for|events for|meetings for)\s+([a-zA-Z\-_]+)/gi,
      /([a-zA-Z\-_]+)\s+(?:activities|events|meetings|work|project)/gi,
      /(?:list|show|find)\s+([a-zA-Z\-_]+)\s+(?:activities|events|meetings)/gi
    ];

    patterns.forEach(pattern => {
      const matches = messageLower.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 2 && match[1] !== 'all' && match[1] !== 'events') {
          filterKeywords.push(match[1].toLowerCase().trim());
        }
      }
    });

    console.log('Extracted filter keywords:', filterKeywords);

    // Filter events that contain the keywords
    const filteredEvents = allEvents.filter(event => {
      const eventText = `${event.summary} ${event.description}`.toLowerCase();
      return filterKeywords.some(keyword => eventText.includes(keyword));
    });

    console.log('Filtered events:', filteredEvents.map(e => e.summary));

    // Validate that only nespola-related events are included
    expect(filteredEvents).toHaveLength(3);
    expect(filteredEvents.every(event =>
      event.summary?.toLowerCase().includes('nespola') ||
      event.description?.toLowerCase().includes('nespola')
    )).toBe(true);

    // Validate specific events
    const eventTitles = filteredEvents.map(e => e.summary);
    expect(eventTitles).toContain('Daily Report - Nespola');
    expect(eventTitles).toContain('Nespola Project Review');
    expect(eventTitles).toContain('Nespola Sprint Planning');

    // Validate non-nespola events are excluded
    expect(eventTitles).not.toContain('Meeting with John');
    expect(eventTitles).not.toContain('Team Building');
  });

  it('should handle case-insensitive filtering correctly', () => {
    const events: CalendarEvent[] = [
      {
        id: '1',
        summary: 'NESPOLA Meeting',
        description: 'Important meeting',
        start: { dateTime: '2025-04-15T09:00:00+08:00' },
        end: { dateTime: '2025-04-15T10:00:00+08:00' }
      },
      {
        id: '2',
        summary: 'Project Review',
        description: 'Review for Nespola project',
        start: { dateTime: '2025-04-16T14:00:00+08:00' },
        end: { dateTime: '2025-04-16T15:00:00+08:00' }
      },
      {
        id: '3',
        summary: 'Daily Standup',
        description: 'Regular standup meeting',
        start: { dateTime: '2025-04-17T09:00:00+08:00' },
        end: { dateTime: '2025-04-17T09:30:00+08:00' }
      }
    ];

    const keyword = 'nespola';
    const filteredEvents = events.filter(event => {
      const eventText = `${event.summary} ${event.description}`.toLowerCase();
      return eventText.includes(keyword.toLowerCase());
    });

    expect(filteredEvents).toHaveLength(2);
    expect(filteredEvents[0].summary).toBe('NESPOLA Meeting');
    expect(filteredEvents[1].summary).toBe('Project Review');
  });
});
