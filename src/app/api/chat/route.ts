import { ModelType } from '@/config/models';
import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { CalendarTools } from '@/tools/calendar-tools';
import { EmailTools } from '@/tools/email-tools';
import { FileTools } from '@/tools/file-tools';
import { createToolRegistry } from '@/tools/tool-registry';
import { WebTools } from '@/tools/web-tools';
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
    if (session.error === 'RefreshAccessTokenError') {
      return NextResponse.json(
        { error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' },
        { status: 401 }
      );
    }

    const {
      message,
      model = 'gpt-4o-mini',
      useTools = false,
      orchestratorModel = 'gpt-4o-mini',
      developmentMode = false
    } = await request.json() as {
      message: string;
      model?: ModelType;
      useTools?: boolean;
      orchestratorModel?: ModelType;
      developmentMode?: boolean;
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Translate message to English if needed
    const englishMessage = await aiService.translateToEnglish(message);

    // Choose between tool-based approaches
    if (useTools) {
      // Check if this should use the new agentic orchestrator
      if (developmentMode) {
        // NEW: Agentic orchestration approach with all tool categories
        console.log('🤖 Using AGENTIC mode with orchestrator');
        console.log('🤖 Parameters:', { useTools, developmentMode, orchestratorModel });
        console.log('🤖 Message:', englishMessage);

        const calendarTools = new CalendarTools(calendarService);
        const emailTools = new EmailTools();
        const fileTools = new FileTools();
        const webTools = new WebTools();

        const toolRegistry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

        console.log('🤖 Tool registry created, calling orchestrator...');
        const result = await aiService.processMessageWithOrchestrator(
          englishMessage,
          toolRegistry,
          orchestratorModel,
          developmentMode
        );

        console.log('🤖 Orchestrator result:', { success: result.success, steps: result.steps?.length, toolCalls: result.toolCalls?.length });

        return NextResponse.json({
          success: result.success,
          message: result.response,
          steps: result.steps,
          toolCalls: result.toolCalls,
          approach: 'agentic',
          error: result.error
        });

      } else {
        // EXISTING: Simple tool-based approach
        console.log('🔧 Using SIMPLE tool mode');
        const calendarTools = new CalendarTools(calendarService);

        const result = await aiService.processMessageWithTools(
          englishMessage,
          calendarTools
        );

        return NextResponse.json({
          success: true,
          message: result.response,
          toolCalls: result.toolCalls,
          approach: 'tools'
        });
      }

    } else {
      // LEGACY: JSON-based approach for backwards compatibility
      console.log('📜 Using LEGACY JSON mode');
      return await processWithJsonApproach(englishMessage, calendarService, aiService, model, message);
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return handleApiError(error);
  }
}

// Legacy JSON-based processing function
async function processWithJsonApproach(
  englishMessage: string,
  calendarService: CalendarService,
  aiService: AIService,
  model: ModelType,
  originalMessage: string
) {
  try {
    // Get existing events for context (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const existingEvents = await calendarService.getEvents(
      thirtyDaysAgo.toISOString(),
      new Date().toISOString()
    );

    // Process the message with AI
    const action = await aiService.processMessage(englishMessage, existingEvents.items, model);

    // Debug logging
    console.log('Original message:', originalMessage);
    console.log('Processed action:', JSON.stringify(action, null, 2));

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

        // Extract filter keywords from the original message
        const messageLower = originalMessage.toLowerCase();
        const filterKeywords: string[] = [];

        // Common patterns to extract filter terms (company names, project names, etc.)
        const patterns = [
          /(?:for|about|regarding|related to|relative to)\s+([a-zA-Z\-_]+)/gi,
          /(?:activities for|events for|meetings for)\s+([a-zA-Z\-_]+)/gi,
          /([a-zA-Z\-_]+)\s+(?:activities|events|meetings|work|project)/gi,
          /(?:list|show|find)\s+([a-zA-Z\-_]+)\s+(?:activities|events|meetings)/gi
        ];

        patterns.forEach(pattern => {
          const matches = messageLower.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && match[1].length > 2 && match[1] !== 'all' && match[1] !== 'events') { // Avoid short words and generic terms
              filterKeywords.push(match[1].toLowerCase().trim());
            }
          }
        });

        // Get all events without server-side filtering for better transparency
        const events = await calendarService.getEvents(
          timeMin,
          timeMax,
          2500, // maxResults
          undefined, // No server-side search query
          false, // showDeleted
          'startTime', // orderBy
          'Asia/Makassar' // timeZone
        );

        // Apply client-side filtering if we have filter keywords
        let filteredEvents = events.items;
        if (filterKeywords.length > 0) {
          filteredEvents = events.items.filter(event => {
            const eventText = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
            return filterKeywords.some(keyword => eventText.includes(keyword));
          });
        }

        result = filteredEvents;

        if (filterKeywords.length > 0) {
          responseMessage = `📅 Found ${filteredEvents.length} event(s) matching "${filterKeywords.join(', ')}"`;
        } else {
          responseMessage = `📅 Found ${filteredEvents.length} event(s)`;
        }

        // Add time range info to response
        const startDate = new Date(timeMin).toLocaleDateString();
        const endDate = new Date(timeMax).toLocaleDateString();
        if (startDate !== endDate) {
          responseMessage += ` from ${startDate} to ${endDate}`;
        } else {
          responseMessage += ` for ${startDate}`;
        }

        break;

      default:
        responseMessage = 'I\'m not sure how to help with that. Please try rephrasing your request.';
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      action: action.type,
      events: result, // Always include events for list operations
      data: result,
      approach: 'legacy'
    });

  } catch (error) {
    console.error('Legacy processing error:', error);
    throw error;
  }
}

// Error handling helper
function handleApiError(error: unknown) {
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
