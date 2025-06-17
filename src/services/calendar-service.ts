import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { serverDevLogger } from '../lib/dev-logger';
import { CalendarEvent, EventList } from '../types/calendar';

export class CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async getEvents(
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    showDeleted?: boolean,
    orderBy?: 'startTime' | 'updated',
    timeZone?: string
  ): Promise<EventList> {
    const startTime = Date.now();
    const params = {
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: maxResults || 2500,
      q,
      showDeleted: showDeleted || false,
      orderBy: orderBy || 'startTime',
      singleEvents: true,
      timeZone: timeZone || 'Asia/Makassar',
    };

    try {
      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        payload: params,
      });

      const response = await this.calendar.events.list(params);
      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        response: {
          eventsCount: response.data.items?.length || 0,
          nextPageToken: response.data.nextPageToken,
          summary: response.data.summary,
          updated: response.data.updated,
        },
        duration,
      });

      return response.data as EventList;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log the error
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      throw error;
    }
  }

  async createEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const startTime = Date.now();

    try {
      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'POST',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        payload: {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
          attendees: event.attendees,
        },
      });

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'POST',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        response: {
          eventId: response.data.id,
          summary: response.data.summary,
          created: response.data.created,
          htmlLink: response.data.htmlLink,
        },
        duration,
      });

      return response.data as CalendarEvent;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log the error
      serverDevLogger.log({
        service: 'calendar',
        method: 'POST',
        endpoint: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      throw error;
    }
  }

  async updateEvent(eventId: string, updateData: CalendarEvent): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId,
        requestBody: updateData,
      });

      return response.data as CalendarEvent;
    } catch (error) {
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });
    } catch (error) {
      throw error;
    }
  }
}
