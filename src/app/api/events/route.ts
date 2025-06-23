import { authOptions, createGoogleAuth } from '@/lib/auth';
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

    const eventData = await request.json();

    if (!eventData.summary) {
      return NextResponse.json(
        { error: 'Event title (summary) is required' },
        { status: 400 }
      );
    }

    // Extract calendarId from eventData, default to 'primary'
    const calendarId = eventData.calendarId || 'primary';
    console.log(`📅 Using calendar: ${calendarId}`);

    // Initialize calendar service
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);

    console.log(`📅 Creating new event:`, eventData);

    // Create the event
    const newEvent = await calendarService.createEvent(eventData, calendarId);

    console.log(`✅ Event created successfully:`, newEvent.id);

    return NextResponse.json({
      success: true,
      event: newEvent,
      message: 'Event created successfully'
    });

  } catch (error) {
    console.error('Create event API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create event'
      },
      { status: 500 }
    );
  }
}
