import { ModelType } from '@/appconfig/models';
import { authOptions, createGoogleAuth } from '@/lib/auth';
import { AIService } from '@/services/ai-service';
import { CalendarService } from '@/services/calendar-service';
import { CalendarTools } from '@/tools/calendar-tools';
import { EmailTools } from '@/tools/email-tools';
import { FileTools } from '@/tools/file-tools';
import { createToolRegistry } from '@/tools/tool-registry';
// import { WebTools } from '@/tools/web-tools'; // Disabled to force vector search usage
import { registerKnowledgeTools } from '@/tools/knowledge-tools';
import { ExtendedSession } from '@/types/auth';
import { getServerSession } from 'next-auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;

    if (!session?.accessToken) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for token refresh errors
    if (session.error === 'RefreshAccessTokenError') {
      return new Response(
        JSON.stringify({ error: 'Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const {
      message,
      messages,
      useTools = false,
      orchestratorModel = 'gpt-4.1-mini',
      developmentMode = false,
      calendarId = 'primary',
      fileIds = []
      // Note: processedFiles not yet implemented in streaming mode
    } = await request.json() as {
      message: string;
      messages?: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>;
      useTools?: boolean;
      orchestratorModel?: ModelType;
      developmentMode?: boolean;
      calendarId?: string;
      fileIds?: string[];
      processedFiles?: Array<{
        fileName: string;
        fileSize: number;
        fileType: string;
        fileId?: string;
        imageData?: string;
        isImage?: boolean;
      }>;
    };

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📅 Using calendar: ${calendarId}`);

    // Only stream for agentic mode
    if (!useTools || !developmentMode) {
      return new Response(
        JSON.stringify({ error: 'Streaming only available for agentic mode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize services
    const googleAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    const calendarService = new CalendarService(googleAuth);
    const aiService = new AIService(process.env.OPENAI_API_KEY!);

    // Translate message to English if needed
    console.log('🔤 Original message:', message);
    let englishMessage = await aiService.translateToEnglish(message);
    console.log('🔤 Translated message:', englishMessage);

    // Check if translation fucked up the message
    if (englishMessage.includes('already in English') || englishMessage.includes('text is in English')) {
      console.warn('⚠️ Translation failed, using original message');
      englishMessage = message;
    }

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Function to send progress updates
        const sendProgress = (data: { type: string; message?: string; [key: string]: unknown }) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Start orchestration with progress streaming
        (async () => {
          try {
            console.log('🌊 Starting streaming orchestration for:', englishMessage);

            const calendarTools = new CalendarTools(calendarService, calendarId);
            const emailTools = new EmailTools();
            const fileTools = new FileTools();
            // Disabled web tools to force use of vector search for knowledge queries
            // const webTools = new WebTools();

            const toolRegistry = createToolRegistry(calendarTools, emailTools, fileTools);

            // Register knowledge tools (including vector search) for non-calendar queries
            registerKnowledgeTools(toolRegistry);

            // Process with streaming progress
            const result = await aiService.processMessageWithOrchestratorStreaming(
              englishMessage,
              messages || [],
              toolRegistry,
              orchestratorModel,
              developmentMode,
              sendProgress,
              fileIds
            );

            // Send final result
            console.log('📤🔥 Sending final result:', {
              success: result.success,
              messageLength: result.response?.length || 0,
              hasSteps: !!result.steps?.length,
              hasToolCalls: !!result.toolCalls?.length,
              actualResponse: result.response?.substring(0, 200),
              fullResult: JSON.stringify(result, null, 2)
            });

            const finalData = {
              type: 'final',
              success: result.success,
              message: result.response,
              steps: result.steps,
              toolCalls: result.toolCalls,
              progressMessages: result.progressMessages,
              approach: 'agentic',
              error: result.error
            };

            console.log('📤🔥 FINAL DATA BEING SENT:', JSON.stringify(finalData, null, 2));

            sendProgress(finalData);

            controller.close();
          } catch (error) {
            console.error('Streaming orchestration error:', error);
            sendProgress({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            controller.close();
          }
        })();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Stream API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
