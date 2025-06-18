import { CalendarService } from '../services/calendar-service';
import { CalendarTools } from '../tools/calendar-tools';
import { EventList, SimplifiedEvent } from '../types/calendar';

describe('CalendarTools', () => {
  let calendarTools: CalendarTools;
  let mockCalendarService: jest.Mocked<CalendarService>;

  beforeEach(() => {
    mockCalendarService = {
      getEvents: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    } as unknown as jest.Mocked<CalendarService>;

    calendarTools = new CalendarTools(mockCalendarService);
  });

  describe('getEvents', () => {
    it('should return simplified events for AI processing', async () => {
      // Mock response from Google Calendar API with verbose data
      const mockApiResponse: EventList = {
        items: [
          {
            id: '123',
            summary: 'Nespola Meeting',
            description: 'Project discussion',
            start: { dateTime: '2025-06-18T14:00:00+08:00' },
            end: { dateTime: '2025-06-18T15:00:00+08:00' },
            location: 'Office',
            attendees: [
              { email: 'user1@example.com' },
              { email: 'user2@example.com' }
            ],
            status: 'confirmed' as const,
          }
        ]
      };

      mockCalendarService.getEvents.mockResolvedValue(mockApiResponse);

      const result = await calendarTools.getEvents();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const event = (result.data as SimplifiedEvent[])[0];

      // Verify simplified event structure contains only essential data
      expect(event).toEqual({
        id: '123',
        title: 'Nespola Meeting',
        description: 'Project discussion',
        startDate: '2025-06-18T14:00:00+08:00',
        endDate: '2025-06-18T15:00:00+08:00',
        isAllDay: false,
        location: 'Office',
        attendeeCount: 2,
        status: 'confirmed'
      });
    });

    it('should handle all-day events correctly', async () => {
      const mockApiResponse: EventList = {
        items: [
          {
            id: '456',
            summary: 'All Day Event',
            start: { date: '2025-06-18' },
            end: { date: '2025-06-19' },
            status: 'confirmed' as const
          }
        ]
      };

      mockCalendarService.getEvents.mockResolvedValue(mockApiResponse);

      const result = await calendarTools.getEvents();

      expect(result.success).toBe(true);
      const event = (result.data as SimplifiedEvent[])[0];

      expect(event.isAllDay).toBe(true);
      expect(event.startDate).toBe('2025-06-18');
      expect(event.endDate).toBe('2025-06-19');
    });
  });

  describe('searchEvents', () => {
    it('should search and filter events by query with date range filtering', async () => {
      const mockApiResponse: EventList = {
        items: [
          {
            id: '1',
            summary: 'Nespola Meeting 1',
            start: { dateTime: '2025-03-15T14:00:00+08:00' },
            end: { dateTime: '2025-03-15T15:00:00+08:00' },
            status: 'confirmed' as const
          },
          {
            id: '2',
            summary: 'daily report - nespola',
            start: { date: '2025-05-10' },
            end: { date: '2025-05-11' },
            status: 'confirmed' as const
          },
          {
            id: '3',
            summary: 'Other Meeting',
            start: { dateTime: '2025-07-01T14:00:00+08:00' },
            end: { dateTime: '2025-07-01T15:00:00+08:00' },
            status: 'confirmed' as const
          }
        ]
      };

      mockCalendarService.getEvents.mockResolvedValue(mockApiResponse);

      const result = await calendarTools.searchEvents('nespola', {
        start: '2025-03-01',
        end: '2025-06-30'
      });

      expect(result.success).toBe(true);
      const events = result.data as SimplifiedEvent[];

      // Should return only the events that:
      // 1. Contain "nespola" (case insensitive)
      // 2. Fall within the date range (March 1 - June 30, 2025)
      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Nespola Meeting 1');
      expect(events[1].title).toBe('daily report - nespola');

      // Event from July should be filtered out by date range
      expect(events.find(e => e.title === 'Other Meeting')).toBeUndefined();
    });

    it('should return meaningful message about search results', async () => {
      const mockApiResponse: EventList = { items: [] };
      mockCalendarService.getEvents.mockResolvedValue(mockApiResponse);

      const result = await calendarTools.searchEvents('nonexistent');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Found 0 events matching "nonexistent"');
    });
  });

  describe('error handling', () => {
    it('should handle calendar service errors gracefully', async () => {
      mockCalendarService.getEvents.mockRejectedValue(new Error('API Error'));

      const result = await calendarTools.getEvents();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.message).toBe('Failed to retrieve calendar events');
    });
  });
});
