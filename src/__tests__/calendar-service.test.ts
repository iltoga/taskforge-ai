import { CalendarService } from '../services/calendar-service';
import { CalendarEvent, EventList } from '../types/calendar';

// Mock the googleapis
jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(),
    auth: {
      OAuth2: jest.fn(),
    }
  }
}));

import { google } from 'googleapis';
const mockGoogle = google as jest.Mocked<typeof google>;

describe('CalendarService', () => {
  let calendarService: CalendarService;
  let mockAuth: {
    setCredentials: jest.Mock;
    getAccessToken: jest.Mock;
  };
  let mockCalendarAPI: {
    events: {
      list: jest.Mock;
      insert: jest.Mock;
      patch: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockAuth = {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
    };

    mockCalendarAPI = {
      events: {
        list: jest.fn(),
        insert: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
      }
    };

    // Setup the mock to return our mock calendar API
    mockGoogle.calendar.mockReturnValue(mockCalendarAPI as never);

    calendarService = new CalendarService(mockAuth as never);
  });

  describe('getEvents', () => {
    it('should fetch events from Google Calendar API', async () => {
      // Arrange
      const mockEvents: EventList = {
        items: [
          {
            id: '1',
            summary: 'Test Event',
            start: { dateTime: '2024-06-15T10:00:00+08:00' },
            end: { dateTime: '2024-06-15T11:00:00+08:00' }
          }
        ]
      };

      mockCalendarAPI.events.list.mockResolvedValue({ data: mockEvents });

      // Act
      const result = await calendarService.getEvents();

      // Assert
      expect(result).toEqual(mockEvents);
      expect(mockCalendarAPI.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: undefined,
        timeMax: undefined,
        maxResults: 250, // Updated default
        q: undefined,
        showDeleted: false,
        orderBy: 'startTime',
        singleEvents: true,
        timeZone: 'UTC', // Updated default
      });
    });

    it('should fetch events with time range when provided', async () => {
      // Arrange
      const timeMin = '2024-06-15T00:00:00Z';
      const timeMax = '2024-06-22T23:59:59Z';
      const mockEvents: EventList = { items: [] };

      mockCalendarAPI.events.list.mockResolvedValue({ data: mockEvents });

      // Act
      await calendarService.getEvents(timeMin, timeMax);

      // Assert
      expect(mockCalendarAPI.events.list).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults: 250, // Updated default
        q: undefined,
        showDeleted: false,
        orderBy: 'startTime',
        singleEvents: true,
        timeZone: 'UTC', // Updated default
      });
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockCalendarAPI.events.list.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(calendarService.getEvents()).rejects.toThrow('API Error');
    });
  });

  describe('createEvent', () => {
    it('should create a new event in Google Calendar', async () => {
      // Arrange
      const newEvent: CalendarEvent = {
        summary: 'New Test Event',
        description: 'Test description',
        start: { dateTime: '2024-06-15T10:00:00+08:00' },
        end: { dateTime: '2024-06-15T11:00:00+08:00' }
      };

      const createdEvent: CalendarEvent = {
        ...newEvent,
        id: 'created-event-id'
      };

      mockCalendarAPI.events.insert.mockResolvedValue({ data: createdEvent });

      // Act
      const result = await calendarService.createEvent(newEvent);

      // Assert
      expect(result).toEqual(createdEvent);
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: newEvent
      });
    });

    it('should create an all-day event when only date is provided', async () => {
      // Arrange
      const allDayEvent: CalendarEvent = {
        summary: 'All Day Event',
        start: { date: '2024-06-15' },
        end: { date: '2024-06-16' }
      };

      mockCalendarAPI.events.insert.mockResolvedValue({ data: allDayEvent });

      // Act
      await calendarService.createEvent(allDayEvent);

      // Assert
      expect(mockCalendarAPI.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: allDayEvent
      });
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', async () => {
      // Arrange
      const eventId = 'event-123';
      const updateData: CalendarEvent = {
        summary: 'Updated Event Title'
      };

      const updatedEvent: CalendarEvent = {
        id: eventId,
        summary: 'Updated Event Title',
        start: { dateTime: '2024-06-15T10:00:00+08:00' },
        end: { dateTime: '2024-06-15T11:00:00+08:00' }
      };

      mockCalendarAPI.events.patch.mockResolvedValue({ data: updatedEvent });

      // Act
      const result = await calendarService.updateEvent(eventId, updateData);

      // Assert
      expect(result).toEqual(updatedEvent);
      expect(mockCalendarAPI.events.patch).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId,
        requestBody: updateData
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event from Google Calendar', async () => {
      // Arrange
      const eventId = 'event-to-delete';

      mockCalendarAPI.events.delete.mockResolvedValue({});

      // Act
      await calendarService.deleteEvent(eventId);

      // Assert
      expect(mockCalendarAPI.events.delete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId
      });
    });
  });
});
