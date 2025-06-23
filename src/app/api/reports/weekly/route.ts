import { ModelType } from '@/appconfig/models';
import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🚀 Weekly report API called');

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


    const { company, startDate, endDate, model = 'gpt-4.1-mini-2025-04-14' } = await request.json() as {
      company: string;
      startDate: string;
      endDate: string;
      model?: ModelType;
    };

    if (!company || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Company, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Get work report events for the specified date range
    const events = await calendarService.getEvents(startDate, endDate);

    // Debug: Log event count and first few summaries
    console.log(`📅 Found ${events.items.length} events between ${startDate} and ${endDate}`);
    if (events.items.length > 0) {
      console.log('Sample event summaries:', events.items.slice(0, 3).map(e => e.summary));
    }

    // Filter for daily report events for the specified company
    const dailyReports = events.items.filter(event => {
      const summary = event.summary?.toLowerCase() || '';
      return summary.includes('daily report') && summary.includes(company.toLowerCase());
    });

    // Improved error handling with detailed messages
    if (dailyReports.length === 0) {
      const errorDetails = {
        company,
        startDate,
        endDate,
        totalEvents: events.items.length,
        sampleSummaries: events.items.slice(0, 3).map(e => e.summary)
      };

      console.error('❌ No daily reports found:', errorDetails);
      return NextResponse.json(
        {
          success: false,
          error: 'No daily reports found for the specified company and date range',
          details: errorDetails
        },
        { status: 404 }
      );
    }

    // Try generating the report
    try {
      const weeklyReport = await aiService.generateWeeklyReport(
        dailyReports,
        company,
        startDate,
        endDate,
        model
      );

      return NextResponse.json({
        success: true,
        report: {
          period: `${startDate} to ${endDate}`,
          totalEvents: dailyReports.length,
          workingHours: 0, // This could be calculated if needed
          meetingHours: 0, // This could be calculated if needed
          summary: weeklyReport,
          events: dailyReports.map(event => ({
            title: event.summary || 'Untitled Event',
            duration: event.start?.dateTime && event.end?.dateTime
              ? `${new Date(event.start.dateTime).toLocaleTimeString()} - ${new Date(event.end.dateTime).toLocaleTimeString()}`
              : 'All day',
            type: 'daily-report'
          }))
        },
        dailyReportsCount: dailyReports.length,
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
    console.error('Weekly report API error:', error);

    // Provide more specific error messages
    let errorMessage = 'Failed to generate weekly report. Please try again.';

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
