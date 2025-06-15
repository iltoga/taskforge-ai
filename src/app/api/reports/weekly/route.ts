import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService, ModelType } from '@/services/ai-service';
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

    const { company, startDate, endDate, model = 'gpt-4o-mini' } = await request.json() as {
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
    const googleAuth = createGoogleAuth(session.accessToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Get work report events for the specified date range
    const events = await calendarService.getEvents(startDate, endDate);

    // Filter for daily report events for the specified company
    const dailyReports = events.items.filter(event =>
      event.summary?.toLowerCase().includes('daily report') &&
      event.summary?.toLowerCase().includes(company.toLowerCase())
    );

    if (dailyReports.length === 0) {
      return NextResponse.json(
        { error: 'No daily reports found for the specified company and date range' },
        { status: 404 }
      );
    }

    // Generate weekly report using AI
    const weeklyReport = await aiService.generateWeeklyReport(
      dailyReports,
      company,
      startDate,
      endDate,
      model
    );

    return NextResponse.json({
      success: true,
      report: weeklyReport,
      dailyReportsCount: dailyReports.length,
    });

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
