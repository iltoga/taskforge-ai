import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService, ModelType } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { ExtendedSession } from '@/types/auth';
import { CalendarEvent } from '@/types/calendar';
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
    if ('error' in session && (session as ExtendedSession & { error?: string }).error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' },
        { status: 401 }
      );
    }

    const { message, model = 'gpt-4o-mini' } = await request.json() as {
      message: string;
      model?: ModelType;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Translate message to English if needed
    const englishMessage = await aiService.translateToEnglish(message);

    // Get existing events for context (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const existingEvents = await calendarService.getEvents(
      thirtyDaysAgo.toISOString(),
      new Date().toISOString()
    );

    // Process the message with AI
    const action = await aiService.processMessage(englishMessage, existingEvents.items, model);

    let result: CalendarEvent | CalendarEvent[] | void = undefined;
    let responseMessage = '';

    switch (action.type) {
      case 'create':
        if (action.event) {
          result = await calendarService.createEvent(action.event);
          responseMessage = `✅ Created event: "${action.event.summary}"`;
        }
        break;

      case 'update':
        if (action.eventId && action.event) {
          result = await calendarService.updateEvent(action.eventId, action.event);
          responseMessage = `✅ Updated event: "${action.event.summary || 'Event updated'}"`;
        }
        break;

      case 'delete':
        if (action.eventId) {
          await calendarService.deleteEvent(action.eventId);
          responseMessage = '✅ Event deleted successfully';
        }
        break;

      case 'list':
        const timeMin = action.timeRange?.start || new Date().toISOString();
        const timeMax = action.timeRange?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const events = await calendarService.getEvents(timeMin, timeMax);
        result = events.items;
        responseMessage = `📅 Found ${events.items.length} event(s)`;
        break;

      default:
        responseMessage = 'I\'m not sure how to help with that. Please try rephrasing your request.';
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      action: action.type,
      data: result,
    });

  } catch (error) {
    console.error('Chat API error:', error);

    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to process your request. Please try again.';
    let statusCode = 500;

    if (error instanceof Error) {
      // Google Calendar API authentication errors
      if (error.message.includes('invalid authentication') ||
          error.message.includes('OAuth 2 access token') ||
          error.message.includes('login cookie') ||
          error.message.includes('authentication credential')) {
        errorMessage = 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.';
        statusCode = 401;
      }
      // Google Calendar permission errors
      else if (error.message.includes('insufficient permissions') ||
               error.message.includes('calendar') && error.message.includes('access')) {
        errorMessage = 'Insufficient Google Calendar permissions. Please ensure you have granted calendar access during sign-in.';
        statusCode = 403;
      }
      // OpenAI API errors
      else if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API key is invalid or missing. Please check your configuration.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        statusCode = 429;
      } else if (error.message.includes('model')) {
        errorMessage = 'The selected AI model is not available. Please try a different model.';
      } else if (error.message.includes('context')) {
        errorMessage = 'Request too long. Please try with a shorter message.';
      } else if (error.message.includes('quota')) {
        errorMessage = 'API quota exceeded. Please check your OpenAI billing.';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: statusCode }
    );
  }
}
