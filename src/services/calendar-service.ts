import { OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { CalendarEvent, EventList } from '../types/calendar';

export class CalendarService {
  private calendar: calendar_v3.Calendar;

  constructor(auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async getEvents(timeMin?: string, timeMax?: string): Promise<EventList> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        orderBy: 'startTime',
        singleEvents: true,
      });

      return response.data as EventList;
    } catch (error) {
      throw error;
    }
  }

  async createEvent(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data as CalendarEvent;
    } catch (error) {
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
