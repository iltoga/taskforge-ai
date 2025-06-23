import { authOptions } from '@/lib/auth';
import { CalendarService } from '@/services/calendar-service';
import { OAuth2Client } from 'google-auth-library';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

interface SessionWithTokens {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    email?: string;
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create OAuth2 client with the session token
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Type assertion to access the custom properties
    const sessionWithTokens = session as SessionWithTokens;

    oauth2Client.setCredentials({
      access_token: sessionWithTokens.accessToken,
      refresh_token: sessionWithTokens.refreshToken,
    });

    const calendarService = new CalendarService(oauth2Client);
    const calendars = await calendarService.getCalendarList();

    // Transform the data to match our CalendarInfo interface
    const calendarList = calendars.map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Unnamed Calendar',
      primary: cal.primary || false,
      accessRole: cal.accessRole || 'reader',
      backgroundColor: cal.backgroundColor,
    }));

    return NextResponse.json({
      calendars: calendarList,
      count: calendarList.length
    });

  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}
