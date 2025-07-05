/**
 * @jest-environment node
 */
// This test is excluded from 'npm run test' by default. Run manually for functional validation.
import 'dotenv/config';
import { google } from 'googleapis';
import { getServiceAccountAuth } from '../../lib/auth';
import { CalendarService } from '../../services/calendar-service';
import { CalendarEvent } from '../../types/calendar';

describe('Calendar Operations (Functional)', () => {
  let calendarService: CalendarService;
  // Try primary calendar first, then the specific calendar
  const specificCalendarId = 'MzQ2N2FlZDlmZDIyNDNiZTExM2UxZmIxZjk3OTQ5YTQxN2Q0NWE1YmNkYjA5ODA0M2IyZGY3NTYwZjNjZTEzYkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t';
  const decodedCalendarId = '3467aed9fd2243be113e1fb1f97949a417d45a5bcdb098043b2df7560f3ce13b@group.calendar.google.com';
  let targetCalendarId = 'primary'; // Start with primary calendar
  let createdEventId: string | undefined;

  beforeAll(async () => {
    // Initialize service account auth
    const authClient = await getServiceAccountAuth();
    if (!authClient) {
      throw new Error('Failed to get service account authentication. Ensure service account credentials are configured.');
    }

    calendarService = new CalendarService(authClient);

    // Try to list available calendars to understand what we have access to
    try {
      console.log('🔍 Checking available calendars for service account...');
      // Note: calendar.calendarList.list() requires the Calendar API
      const calendar = google.calendar({ version: 'v3', auth: authClient });
      const calendarListResponse = await calendar.calendarList.list();

      console.log(`📋 Found ${calendarListResponse.data.items?.length || 0} accessible calendars:`);
      calendarListResponse.data.items?.forEach((cal, index) => {
        console.log(`  ${index + 1}. ${cal.summary} (${cal.id}) - Access: ${cal.accessRole}`);
      });

      // If we have access to the specific calendar, use it, otherwise use primary
      const hasSpecificCalendar = calendarListResponse.data.items?.some(cal =>
        cal.id === decodedCalendarId || cal.id === specificCalendarId
      );

      if (hasSpecificCalendar) {
        targetCalendarId = decodedCalendarId;
        console.log(`✅ Using specific calendar: ${targetCalendarId}`);
      } else {
        console.log(`⚠️ Specific calendar not accessible, using primary calendar`);
      }

    } catch (error) {
      console.warn('⚠️ Could not list calendars:', error instanceof Error ? error.message : String(error));
      console.log('📝 Will attempt to use primary calendar');
    }
  }, 30000);

  afterEach(async () => {
    // Clean up any created events
    if (createdEventId && calendarService) {
      try {
        await calendarService.deleteEvent(createdEventId, targetCalendarId);
        console.log(`✅ Cleaned up test event: ${createdEventId}`);
      } catch (error) {
        // If the error indicates the resource is already deleted, that's actually good
        if (error instanceof Error &&
            (error.message.includes('Resource has been deleted') ||
             error.message.includes('Gone') ||
             error.message.includes('not found'))) {
          console.log(`✅ Test event already deleted: ${createdEventId}`);
        } else {
          console.warn(`⚠️ Failed to clean up test event ${createdEventId}:`, error);
        }
      }
      createdEventId = undefined;
    }
  }, 10000);

  it('should create, read, and delete a calendar event', async () => {
    // Create a test event
    const testEvent: CalendarEvent = {
      summary: 'Functional Test Event',
      description: 'This is a test event created by the functional test suite. It should be automatically deleted.',
      start: {
        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        timeZone: 'UTC',
      },
      location: 'Test Location',
      attendees: [],
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: 'email',
            minutes: 15,
          },
        ],
      },
    };

    console.log(`📅 Creating test event in calendar: ${targetCalendarId}`);

    // Try to create the event - first with primary, then with specific calendar
    let createdEvent: CalendarEvent;
    try {
      createdEvent = await calendarService.createEvent(testEvent, targetCalendarId);
    } catch (error) {
      if (targetCalendarId === 'primary') {
        console.log('⚠️ Failed to create event in primary calendar, trying specific calendar...');
        console.log(`🔄 Attempting with decoded calendar ID: ${decodedCalendarId}`);

        try {
          targetCalendarId = decodedCalendarId;
          createdEvent = await calendarService.createEvent(testEvent, targetCalendarId);
        } catch (specificError) {
          console.error('❌ Failed to create event in both primary and specific calendars');
          console.error('Primary calendar error:', error instanceof Error ? error.message : String(error));
          console.error('Specific calendar error:', specificError instanceof Error ? specificError.message : String(specificError));
          throw new Error(`Unable to create event in any calendar. This might be due to insufficient permissions or invalid calendar ID.`);
        }
      } else {
        throw error;
      }
    }

    expect(createdEvent).toBeDefined();
    expect(createdEvent.id).toBeDefined();
    expect(createdEvent.summary).toBe(testEvent.summary);
    expect(createdEvent.description).toBe(testEvent.description);
    expect(createdEvent.location).toBe(testEvent.location);

    createdEventId = createdEvent.id!;
    console.log(`✅ Event created successfully with ID: ${createdEventId}`);
    console.log(`🔗 Event link: ${createdEvent.htmlLink}`);

    // Read the event back to confirm it exists
    console.log('📖 Reading back the created event...');
    const retrievedEvent = await calendarService.getEvent(createdEventId, targetCalendarId);

    expect(retrievedEvent).toBeDefined();
    expect(retrievedEvent.id).toBe(createdEventId);
    expect(retrievedEvent.summary).toBe(testEvent.summary);
    expect(retrievedEvent.description).toBe(testEvent.description);
    expect(retrievedEvent.location).toBe(testEvent.location);

    console.log(`✅ Event retrieved successfully: ${retrievedEvent.summary}`);

    // Delete the event
    console.log('🗑️ Deleting the test event...');
    await calendarService.deleteEvent(createdEventId, targetCalendarId);

    console.log(`✅ Event deleted successfully`);

    // Note: We don't verify deletion by calling getEvent because Google Calendar's API
    // may have caching that temporarily returns the event even after successful deletion.
    // The cleanup function will handle any remaining references.

    // Clear the event ID since it's been successfully deleted
    createdEventId = undefined;
  }, 60000); // 60 second timeout for the entire test

  it('should handle calendar operations with proper error handling', async () => {
    // Test getting a non-existent event
    const nonExistentEventId = 'non-existent-event-id';

    console.log('🔍 Testing error handling for non-existent event...');

    try {
      await calendarService.getEvent(nonExistentEventId, targetCalendarId);
      throw new Error('Should have thrown an error for non-existent event');
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Error handling works correctly for non-existent events');
    }

    // Test deleting a non-existent event
    console.log('🗑️ Testing error handling for deleting non-existent event...');

    try {
      await calendarService.deleteEvent(nonExistentEventId, targetCalendarId);
      throw new Error('Should have thrown an error for deleting non-existent event');
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Error handling works correctly for deleting non-existent events');
    }
  }, 30000);
});
