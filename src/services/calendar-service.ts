import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { serverDevLogger } from '../lib/dev-logger';
import { CalendarEvent, EventList } from '../types/calendar';

export class CalendarService {
  private calendar: calendar_v3.Calendar;
  private auth: OAuth2Client;

  constructor(auth: OAuth2Client) {
    this.auth = auth;
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Refreshes the calendar client with fresh credentials
   * Useful when tokens are refreshed externally
   */
  private refreshCalendarClient() {
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Handles API calls with automatic token refresh retry
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      // Check if it's an authentication error
      if (error instanceof Error &&
          (error.message.includes('invalid authentication') ||
           error.message.includes('OAuth 2 access token') ||
           error.message.includes('authentication credential'))) {

        serverDevLogger.log({
          service: 'calendar',
          method: 'ERROR_HANDLING',
          endpoint: `${operationName}_AUTH_ERROR`,
          error: `Authentication error in ${operationName}, attempting token refresh: ${error.message}`,
        });

        try {
          // Try to refresh the token using the OAuth2Client
          await this.auth.getAccessToken();
          this.refreshCalendarClient();

          serverDevLogger.log({
            service: 'calendar',
            method: 'ERROR_HANDLING',
            endpoint: `${operationName}_REFRESH_SUCCESS`,
            response: { message: `Token refresh successful, retrying ${operationName}` },
          });

          // Retry the operation with refreshed token
          return await operation();
        } catch (refreshError) {
          serverDevLogger.log({
            service: 'calendar',
            method: 'ERROR_HANDLING',
            endpoint: `${operationName}_REFRESH_FAILED`,
            error: `Token refresh failed for ${operationName}: ${refreshError instanceof Error ? refreshError.message : 'Unknown refresh error'}`,
          });

          // If refresh fails, throw the original error
          throw error;
        }
      }

      // If it's not an auth error, just throw it
      throw error;
    }
  }

  async getEvents(
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    q?: string,
    showDeleted?: boolean,
    orderBy?: 'startTime' | 'updated',
    timeZone?: string,
    calendarId?: string
  ): Promise<EventList> {
    // Convert date strings to RFC3339 format if they're in YYYY-MM-DD format
    const formatDateForCalendarAPI = (dateStr?: string): string | undefined => {
      if (!dateStr) return undefined;

      // If it's already in ISO format, return as is
      if (dateStr.includes('T') || dateStr.includes('Z')) {
        return dateStr;
      }

      // If it's in YYYY-MM-DD format, convert to RFC3339
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return `${dateStr}T00:00:00Z`;
      }

      return dateStr;
    };

    // Use more reasonable defaults for maxResults and timezone
    const params = {
      calendarId: calendarId || 'primary',
      timeMin: formatDateForCalendarAPI(timeMin),
      timeMax: formatDateForCalendarAPI(timeMax),
      maxResults: maxResults || 250, // Reduced from 2500 to avoid too many old events
      q,
      showDeleted: showDeleted || false,
      orderBy: orderBy || 'startTime',
      singleEvents: true,
      timeZone: timeZone || 'UTC', // Use UTC instead of hardcoded Asia/Makassar
    };

    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events`,
        payload: params,
      });

      const response = await this.calendar.events.list(params);
      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events`,
        response: {
          eventsCount: response.data.items?.length || 0,
          nextPageToken: response.data.nextPageToken,
          summary: response.data.summary,
          updated: response.data.updated,
        },
        duration,
      });

      return response.data as EventList;
    }, 'getEvents');
  }

  async createEvent(event: CalendarEvent, calendarId?: string): Promise<CalendarEvent> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'POST',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${calendarId || 'primary'}/events`,
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
        calendarId: calendarId || 'primary',
        requestBody: event,
      });

      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'POST',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${calendarId || 'primary'}/events`,
        response: {
          eventId: response.data.id,
          summary: response.data.summary,
          created: response.data.created,
          htmlLink: response.data.htmlLink,
        },
        duration,
      });

      return response.data as CalendarEvent;
    }, 'createEvent');
  }

  async getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${calendarId || 'primary'}/events/${eventId}`,
      });

      const response = await this.calendar.events.get({
        calendarId: calendarId || 'primary',
        eventId,
      });

      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: `https://www.googleapis.com/calendar/v3/calendars/${calendarId || 'primary'}/events/${eventId}`,
        response: {
          eventId: response.data.id,
          summary: response.data.summary,
          created: response.data.created,
          htmlLink: response.data.htmlLink,
        },
        duration,
      });

      return response.data as CalendarEvent;
    }, 'getEvent');
  }

  async updateEvent(eventId: string, updateData: CalendarEvent, calendarId?: string): Promise<CalendarEvent> {
    return this.executeWithRetry(async () => {
      const response = await this.calendar.events.patch({
        calendarId: calendarId || 'primary',
        eventId,
        requestBody: updateData,
      });

      return response.data as CalendarEvent;
    }, 'updateEvent');
  }

  async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    return this.executeWithRetry(async () => {
      await this.calendar.events.delete({
        calendarId: calendarId || 'primary',
        eventId,
      });
    }, 'deleteEvent');
  }

  async getCalendarList(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      // Log the request
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        payload: {},
      });

      const response = await this.calendar.calendarList.list({
        minAccessRole: 'reader',
        showDeleted: false,
        showHidden: false,
      });

      const duration = Date.now() - startTime;

      // Log the successful response
      serverDevLogger.log({
        service: 'calendar',
        method: 'GET',
        endpoint: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        response: {
          calendarsCount: response.data.items?.length || 0,
          calendars: response.data.items?.map(cal => ({
            id: cal.id,
            summary: cal.summary,
            primary: cal.primary,
            accessRole: cal.accessRole,
          })),
        },
        duration,
      });

      return response.data.items || [];
    }, 'getCalendarList');
  }
}
