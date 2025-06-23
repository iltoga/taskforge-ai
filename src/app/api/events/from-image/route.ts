import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check for token refresh errors
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' },
        { status: 401 }
      );
    }

    const { image, fileName, calendarId = 'primary' } = await request.json() as {
      image: string;
      fileName: string;
      calendarId?: string;
    };

    if (!image) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    console.log(`🖼️ Processing image for calendar events: ${fileName}`);
    console.log(`📅 Using calendar: ${calendarId}`);

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Create a specialized prompt for extracting calendar events from images
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    const todayFull = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const analysisPrompt = `You are an AI assistant that analyzes images containing notes, schedules, appointments, or any text that could be converted into calendar events.

IMPORTANT: Today is ${todayFull} (${todayFormatted}).

Your task:
1. Analyze this image carefully for any dates, times, appointments, meetings, deadlines, events, or scheduled activities
2. Extract all relevant information and return a JSON array of events with the following structure:
   - title: Event title/description
   - date: Date in YYYY-MM-DD format (convert relative dates based on the current date above)
   - startTime: Time in HH:MM format (24-hour) or null for all-day events
   - endTime: Time in HH:MM format (24-hour) or null for all-day events
   - location: Location if mentioned, or null
   - description: Any additional details

3. Handle relative dates intelligently:
   - "today" = ${todayFormatted}
   - "tomorrow" = ${new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
   - "next week" = add 7 days from today
   - "Monday", "Tuesday", etc. = find the next occurrence of that day
   - "next Monday" = find the Monday of next week

4. Be smart about interpreting handwritten notes, abbreviations, and informal language
5. If no specific time is mentioned, set startTime and endTime to null (all-day event)
6. Return only valid JSON array, no other text

Example output:
[
  {
    "title": "Doctor appointment",
    "date": "2025-06-25",
    "startTime": "14:30",
    "endTime": "15:30",
    "location": "Medical Center",
    "description": "Annual checkup"
  },
  {
    "title": "Team meeting",
    "date": "2025-06-24",
    "startTime": null,
    "endTime": null,
    "location": null,
    "description": "Project review"
  }
]`;

    // First, use GPT-4 Vision to analyze the image and extract event data
    const visionResponse = await aiService.analyzeImageForEvents(image, analysisPrompt);

    if (!visionResponse || !visionResponse.length) {
      return NextResponse.json({
        success: false,
        error: 'No events could be extracted from the image'
      });
    }

    console.log(`📋 Extracted ${visionResponse.length} events from image:`, visionResponse);

    // Now create calendar events for each extracted event
    const createdEvents = [];
    const errors = [];

    for (const eventData of visionResponse) {
      try {
        // Convert extracted data to Google Calendar format
        const calendarEvent = {
          summary: eventData.title,
          description: eventData.description || '',
          location: eventData.location || '',
          start: eventData.startTime
            ? { dateTime: `${eventData.date}T${eventData.startTime}:00` }
            : { date: eventData.date },
          end: eventData.endTime
            ? { dateTime: `${eventData.date}T${eventData.endTime}:00` }
            : { date: eventData.date }
        };

        const createdEvent = await calendarService.createEvent(calendarEvent, calendarId);
        createdEvents.push(createdEvent);
        console.log(`✅ Created event: ${eventData.title}`);
      } catch (err) {
        const errorMsg = `Failed to create event "${eventData.title}": ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎉 Successfully created ${createdEvents.length} out of ${visionResponse.length} events`);

    return NextResponse.json({
      success: true,
      events: createdEvents,
      message: `Successfully created ${createdEvents.length} calendar events from your image!`,
      analysis: {
        eventsExtracted: visionResponse.length,
        eventsCreated: createdEvents.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Image processing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process image for calendar events'
      },
      { status: 500 }
    );
  }
}
