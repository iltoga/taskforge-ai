import { z } from 'zod';
import { CalendarEvent } from '../types/calendar';
import { CalendarTools } from './calendar-tools';
import { ToolRegistry } from './tool-registry';

export function registerCalendarTools(registry: ToolRegistry, calendarTools: CalendarTools) {
  registry.registerTool(
    {
      name: 'getEvents',
      description: 'Get calendar events within a time range with optional filters. Returns simplified event objects optimized for AI processing (only essential fields: id, title, description, startDate, endDate, isAllDay, location, attendeeCount, status).',
      parameters: z.object({
        timeRange: z.object({
          start: z.string().optional().describe('ISO date string for start time (e.g., "2025-03-01" or "2025-03-01T00:00:00+08:00")'),
          end: z.string().optional().describe('ISO date string for end time (e.g., "2025-06-30" or "2025-06-30T23:59:59+08:00")'),
        }).optional().describe('Time range to search for events'),
        filters: z.object({
          query: z.string().optional().describe('Search query to filter events'),
          maxResults: z.number().optional().describe('Maximum number of results to return (default: 100)'),
          showDeleted: z.boolean().optional().describe('Whether to include deleted events'),
          orderBy: z.enum(['startTime', 'updated']).optional().describe('How to order results'),
        }).optional().describe('Additional filters for events'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { timeRange?: { start?: string; end?: string }; filters?: { query?: string; maxResults?: number; showDeleted?: boolean; orderBy?: 'startTime' | 'updated' } };
      return await calendarTools.getEvents(p.timeRange, p.filters);
    }
  );

  registry.registerTool(
    {
      name: 'searchEvents',
      description: 'Search calendar events by query string. Returns simplified event objects optimized for AI processing. Use this to find events containing specific keywords, company names, or project names in title, description, or location.',
      parameters: z.object({
        query: z.string().describe('Search query to find events (e.g., company name like "Nespola", project name, keyword)'),
        timeRange: z.object({
          start: z.string().optional().describe('ISO date string for start time (e.g., "2025-03-01" or "2025-03-01T00:00:00+08:00")'),
          end: z.string().optional().describe('ISO date string for end time (e.g., "2025-06-30" or "2025-06-30T23:59:59+08:00")'),
        }).optional().describe('Time range to search within'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { query: string; timeRange?: { start?: string; end?: string } };
      return await calendarTools.searchEvents(p.query, p.timeRange);
    }
  );

  registry.registerTool(
    {
      name: 'createEvent',
      description: 'Create a new calendar event. Use this when the user wants to schedule, add, or create an event.',
      parameters: z.object({
        eventData: z.object({
          summary: z.string().describe('Event title/summary'),
          description: z.string().optional().describe('Event description'),
          start: z.object({
            dateTime: z.string().optional().describe('Start date-time (ISO format)'),
            date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).describe('Event start time'),
          end: z.object({
            dateTime: z.string().optional().describe('End date-time (ISO format)'),
            date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).describe('Event end time'),
          location: z.string().optional().describe('Event location'),
          attendees: z.array(z.object({
            email: z.string().describe('Attendee email'),
            displayName: z.string().optional().describe('Attendee display name'),
          })).optional().describe('Event attendees'),
        }).describe('Event data to create'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventData: CalendarEvent };
      return await calendarTools.createEvent(p.eventData);
    }
  );

  registry.registerTool(
    {
      name: 'updateEvent',
      description: 'Update an existing calendar event. Use this when the user wants to modify or change an existing event.',
      parameters: z.object({
        eventId: z.string().describe('ID of the event to update'),
        changes: z.object({
          summary: z.string().optional().describe('Event title/summary'),
          description: z.string().optional().describe('Event description'),
          start: z.object({
            dateTime: z.string().optional().describe('Start date-time (ISO format)'),
            date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).optional().describe('Event start time'),
          end: z.object({
            dateTime: z.string().optional().describe('End date-time (ISO format)'),
            date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).optional().describe('Event end time'),
          location: z.string().optional().describe('Event location'),
          attendees: z.array(z.object({
            email: z.string().describe('Attendee email'),
            displayName: z.string().optional().describe('Attendee display name'),
          })).optional().describe('Event attendees'),
        }).describe('Changes to apply to the event'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventId: string; changes: Partial<CalendarEvent> };
      return await calendarTools.updateEvent(p.eventId, p.changes);
    }
  );

  registry.registerTool(
    {
      name: 'deleteEvent',
      description: 'Delete a calendar event. Use this when the user wants to remove or cancel an event.',
      parameters: z.object({
        eventId: z.string().describe('ID of the event to delete'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventId: string };
      return await calendarTools.deleteEvent(p.eventId);
    }
  );
}
