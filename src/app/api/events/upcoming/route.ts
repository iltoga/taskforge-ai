import { authOptions, createGoogleAuth } from '@/lib/auth';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET() {
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

    // Initialize calendar service
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);

    // Get events for the next 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    console.log(`📅 Fetching upcoming events from ${now.toISOString()} to ${sevenDaysFromNow.toISOString()}`);

    const events = await calendarService.getEvents(
      now.toISOString(),
      sevenDaysFromNow.toISOString(),
      50, // maxResults
      undefined, // No search query
      false, // showDeleted
      'startTime', // orderBy
      undefined // Use default timezone
    );

    console.log(`📅 Found ${events.items.length} upcoming events`);
    if (events.items.length > 0) {
      console.log('Sample events:', events.items.slice(0, 3).map(e => ({
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date
      })));
    }

    return NextResponse.json({
      success: true,
      events: events.items,
      count: events.items.length
    });

  } catch (error) {
    console.error('Upcoming events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch upcoming events'
      },
      { status: 500 }
    );
  }
}
