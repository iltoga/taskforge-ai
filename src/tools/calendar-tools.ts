import { CalendarService } from '../services/calendar-service';
import { CalendarEvent, SimplifiedEvent } from '../types/calendar';

export interface CalendarToolResult {
  success: boolean;
  data?: CalendarEvent | SimplifiedEvent | SimplifiedEvent[] | void;
  error?: string;
  message?: string;
}

export interface TimeRange {
  start?: string;
  end?: string;
}

export interface EventFilters {
  query?: string;
  maxResults?: number;
  showDeleted?: boolean;
  orderBy?: 'startTime' | 'updated';
}

/**
 * Transform a verbose Google Calendar event into a simplified format for AI processing
 */
function simplifyEvent(event: CalendarEvent): SimplifiedEvent {
  const isAllDay = !!event.start?.date && !event.start?.dateTime;

  return {
    id: event.id || '',
    title: event.summary || 'Untitled Event',
    description: event.description || undefined,
    startDate: event.start?.dateTime || event.start?.date || '',
    endDate: event.end?.dateTime || event.end?.date || '',
    isAllDay,
    location: event.location || undefined,
    attendeeCount: event.attendees?.length || undefined,
    status: event.status || 'confirmed'
  };
}

/**
 * Filter events that occurred within the specified date range
 * This is needed because the Google Calendar API q parameter doesn't properly respect timeMin/timeMax
 */
function filterEventsByDateRange(events: SimplifiedEvent[], startDate?: string, endDate?: string): SimplifiedEvent[] {
  if (!startDate && !endDate) return events;

  return events.filter(event => {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);

    // Skip events with invalid dates
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
      return false;
    }

    if (startDate) {
      const rangeStart = new Date(startDate);
      // Event must end after range start
      if (eventEnd < rangeStart) return false;
    }

    if (endDate) {
      const rangeEnd = new Date(endDate);
      // Event must start before range end
      if (eventStart > rangeEnd) return false;
    }

    return true;
  });
}

export class CalendarTools {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    this.calendarService = calendarService;
  }

  /**
   * Get calendar events within a time range with optional filters
   * Returns simplified events optimized for AI processing
   */
  async getEvents(timeRange?: TimeRange, filters?: EventFilters): Promise<CalendarToolResult> {
    try {
      // When we have a time range, prioritize it to avoid getting very old events
      const events = await this.calendarService.getEvents(
        timeRange?.start,
        timeRange?.end,
        filters?.maxResults || 100, // Use reasonable default
        filters?.query,
        filters?.showDeleted || false,
        filters?.orderBy || 'startTime'
      );

      // Transform verbose Google Calendar events into simplified format
      const simplifiedEvents = (events.items || []).map(simplifyEvent);

      // Apply additional date filtering if needed (Google Calendar API q param doesn't always respect timeMin/timeMax)
      const filteredEvents = filterEventsByDateRange(simplifiedEvents, timeRange?.start, timeRange?.end);

      return {
        success: true,
        data: filteredEvents,
        message: `Retrieved ${filteredEvents.length} events${timeRange?.start || timeRange?.end ? ' in specified date range' : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get events',
        message: 'Failed to retrieve calendar events'
      };
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(eventData: CalendarEvent): Promise<CalendarToolResult> {
    try {
      const createdEvent = await this.calendarService.createEvent(eventData);

      return {
        success: true,
        data: createdEvent,
        message: `Created event: "${eventData.summary}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create event',
        message: 'Failed to create calendar event'
      };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId: string, changes: Partial<CalendarEvent>): Promise<CalendarToolResult> {
    try {
      const updatedEvent = await this.calendarService.updateEvent(eventId, changes as CalendarEvent);

      return {
        success: true,
        data: updatedEvent,
        message: `Updated event: "${changes.summary || updatedEvent.summary}"`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update event',
        message: 'Failed to update calendar event'
      };
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<CalendarToolResult> {
    try {
      await this.calendarService.deleteEvent(eventId);

      return {
        success: true,
        message: 'Event deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete event',
        message: 'Failed to delete calendar event'
      };
    }
  }

  /**
   * Search calendar events by query
   * Returns simplified events optimized for AI processing
   */
  async searchEvents(query: string, timeRange?: TimeRange): Promise<CalendarToolResult> {
    try {
      // First try with both query and time range
      const events = await this.calendarService.getEvents(
        timeRange?.start,
        timeRange?.end,
        100, // Use reasonable limit for search
        query,
        false,
        'startTime'
      );

      // Transform verbose Google Calendar events into simplified format
      const simplifiedEvents = (events.items || []).map(simplifyEvent);

      // Apply additional date filtering (Google Calendar API q param doesn't always respect timeMin/timeMax)
      let filteredEvents = filterEventsByDateRange(simplifiedEvents, timeRange?.start, timeRange?.end);

      // Apply additional client-side filtering to ensure query terms are matched (case-insensitive)
      // The Google Calendar API q parameter searches various fields: summary, description, location, attendee emails
      const queryLower = query.toLowerCase();
      filteredEvents = filteredEvents.filter(event => {
        const searchText = [
          event.title,
          event.description || '',
          event.location || ''
        ].join(' ').toLowerCase();

        return searchText.includes(queryLower);
      });

      return {
        success: true,
        data: filteredEvents,
        message: `Found ${filteredEvents.length} events matching "${query}"${timeRange?.start || timeRange?.end ? ' in specified date range' : ''}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search events',
        message: 'Failed to search calendar events'
      };
    }
  }
}
