import { createGoogleAuth } from "@/lib/auth-compat";
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { auth } from "@/lib/auth-compat";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth() as ExtendedSession;

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
    const aiService = new AIService();

    // Create a specialized prompt for extracting calendar events from images
    // First, use GPT-4 Vision to analyze the image and extract event data
    const visionResponse = await aiService.analyzeImageForEvents();

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
