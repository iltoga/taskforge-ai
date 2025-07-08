import { ModelType } from '@/appconfig/models';
import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚀 Reports API called');

  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    console.log('🔐 Session check:', session ? 'Session exists' : 'No session');

    if (!session?.accessToken) {
      console.error('❌ No access token in session');
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

    const {
      company,
      startDate,
      endDate,
      calendarId = 'primary',
      model = 'gpt-4.1-mini',
      reportType = 'weekly'
    } = await request.json() as {
      company?: string;
      startDate: string;
      endDate: string;
      calendarId?: string;
      model?: ModelType;
      reportType?: 'weekly' | 'monthly' | 'quarterly';
    };

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    console.log(`📅 Using calendar: ${calendarId}`);
    console.log(`📊 Report type: ${reportType}`);

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService();

    // Get work report events for the specified date range
    const events = await calendarService.getEvents(startDate, endDate, 250, undefined, false, 'startTime', undefined, calendarId);

    // Debug: Log event count and first few summaries
    console.log(`📅 Found ${events.items.length} events between ${startDate} and ${endDate}`);
    if (events.items.length > 0) {
      console.log('Sample event summaries:', events.items.slice(0, 3).map(e => e.summary));
    }

    // Filter events based on company if provided, otherwise include all events
    const filteredEvents = events.items.filter(event => {
      const summary = event.summary?.toLowerCase() || '';
      if (company && company.trim()) {
        // If company is provided, look for events containing the company name
        return summary.includes(company.toLowerCase());
      }
      // If no company filter, include all events
      return true;
    });

    // Improved error handling with detailed messages
    if (filteredEvents.length === 0) {
      const errorDetails = {
        company,
        startDate,
        endDate,
        reportType,
        totalEvents: events.items.length,
        sampleSummaries: events.items.slice(0, 3).map(e => e.summary)
      };

      console.error('❌ No events found:', errorDetails);
      return NextResponse.json(
        {
          success: false,
          error: company && company.trim()
            ? 'No events found for the specified company and date range'
            : 'No events found for the specified date range',
          details: errorDetails
        },
        { status: 404 }
      );
    }

    // Try generating the report
    try {
      // Extract user name from session, fallback to 'User' if not available
      const userName = session.user?.name || session.user?.email?.split('@')[0] || 'User';

      const report = await aiService.generateReport(
        filteredEvents,
        company ?? '',
        startDate,
        endDate,
        reportType,
        model,
        userName
      );

      return NextResponse.json({
        success: true,
        report: {
          period: `${startDate} to ${endDate}`,
          reportType,
          totalEvents: filteredEvents.length,
          workingHours: 0, // This could be calculated if needed
          meetingHours: 0, // This could be calculated if needed
          summary: report,
          events: filteredEvents.map(event => ({
            title: event.summary || 'Untitled Event',
            description: event.description || null,
            location: event.location || null,
            duration: event.start?.dateTime && event.end?.dateTime
              ? `${new Date(event.start.dateTime).toLocaleTimeString()} - ${new Date(event.end.dateTime).toLocaleTimeString()}`
              : 'All day',
            startDate: event.start?.dateTime || event.start?.date || null,
            endDate: event.end?.dateTime || event.end?.date || null,
            startTimeZone: event.start?.timeZone || null,
            endTimeZone: event.end?.timeZone || null,
            type: 'calendar-event',
            status: event.status || null,
            attendees: event.attendees?.length || 0,
            isAllDay: !event.start?.dateTime
          }))
        },
        eventsCount: filteredEvents.length,
      });
    } catch (genError) {
      console.error('❌ Report generation failed:', genError);
      return NextResponse.json(
        {
          success: false,
          error: 'Report generation failed',
          details: genError instanceof Error ? genError.message : String(genError)
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Reports API error:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to generate report. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API key is invalid or missing. Please check your configuration.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('model')) {
        errorMessage = 'The selected AI model is not available for report generation.';
      } else if (error.message.includes('calendar')) {
        errorMessage = 'Calendar access error. Please check your Google Calendar permissions.';
      } else {
        errorMessage = `Report generation error: ${error.message}`;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
