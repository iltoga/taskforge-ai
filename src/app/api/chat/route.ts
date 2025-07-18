/**
 * @openapi
 * /api/chat:
 *   post:
 *     summary: "Chat endpoint for AI assistant with tool and calendar integration"
 *     description: |
 *       Accepts a user message and optional parameters to interact with the AI assistant, calendar, and tools. Supports agentic orchestration, file processing, and legacy JSON-based flows.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: "The user message or query."
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *                     timestamp:
 *                       type: number
 *               model:
 *                 type: string
 *                 description: "The AI model to use (default: gpt-4.1-mini)"
 *               useTools:
 *                 type: boolean
 *                 description: "Whether to use tool-based orchestration (default: false)"
 *               developmentMode:
 *                 type: boolean
 *                 description: "Enable agentic orchestrator (default: false)"
 *               calendarId:
 *                 type: string
 *                 description: "Calendar ID to use (default: primary)"
 *               processedFiles:
 *                 type: array
 *                 items:
 *                   type: object
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: "Successful response with AI or tool output"
 *       400:
 *         description: "Bad request (missing message or invalid input)"
 *       401:
 *         description: "Authentication required or expired"
 *       403:
 *         description: "Insufficient permissions"
 *       429:
 *         description: "Rate limit exceeded"
 *       500:
 *         description: "Internal server error"
 */
import { ModelType } from "@/appconfig/models";
import { auth, createGoogleAuth } from "@/lib/auth-compat";
import { isServiceAccountMode } from "@/lib/calendar-config";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";
import { EnhancedCalendarService } from "@/services/enhanced-calendar-service";
import { CalendarTools } from "@/tools/calendar-tools";
import { EmailTools } from "@/tools/email-tools";
import { FileSearchTools } from "@/tools/file-search-tools";
import { PassportTools } from "@/tools/passport-tools";
import { createToolRegistry } from "@/tools/tool-registry";
// import { WebTools } from '@/tools/web-tools'; // Disabled to force vector search usage
import { ExtendedSession } from "@/lib/auth-compat";
import { registerKnowledgeTools } from "@/tools/knowledge-tools";
import { CalendarEvent } from "@/types/calendar";
import { ProcessedFile } from "@/types/files";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = (await auth()) as ExtendedSession;

    // Check authentication mode
    const useServiceAccountMode =
      process.env.BYPASS_GOOGLE_AUTH === "true" || isServiceAccountMode();

    // In service account mode, we still need user authentication for the app
    // but calendar operations will use service account
    if (!session && process.env.BYPASS_GOOGLE_AUTH !== "true") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check for token refresh errors in OAuth mode
    if (
      !useServiceAccountMode &&
      session?.error === "RefreshAccessTokenError"
    ) {
      return NextResponse.json(
        {
          error:
            "Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.",
        },
        { status: 401 }
      );
    }

    const {
      message,
      messages,
      model = "gpt-4.1-mini",
      useTools = false,
      developmentMode = false,
      calendarId = "primary",
      processedFiles = [],
    } = (await request.json()) as {
      message: string;
      messages?: Array<{
        id: string;
        type: "user" | "assistant";
        content: string;
        timestamp: number;
      }>;
      model?: ModelType;
      useTools?: boolean;
      developmentMode?: boolean;
      calendarId?: string;
      processedFiles?: Array<ProcessedFile>;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log(`📅 Initial calendar: ${calendarId}`);

    // Determine the actual calendar ID to use based on authentication mode
    let actualCalendarId = calendarId;

    if (useServiceAccountMode) {
      if (process.env.BYPASS_GOOGLE_AUTH === "true") {
        // In bypass mode, use the configured calendar (your calendar)
        const { loadAllowedCalendars, decodeCalendarId } = await import(
          "@/lib/calendar-config"
        );
        const allowedCalendars = loadAllowedCalendars();

        if (allowedCalendars.length > 0) {
          actualCalendarId = decodeCalendarId(allowedCalendars[0].cid);
          console.log(
            `📅 Bypass mode: Using configured calendar: ${actualCalendarId}`
          );
        } else {
          console.warn("⚠️ No allowed calendars configured for bypass mode");
          actualCalendarId = "primary"; // Fallback to service account's own calendar
        }
      } else if (calendarId === "primary") {
        // In service account mode (non-bypass), use the configured calendar
        const { loadAllowedCalendars, decodeCalendarId } = await import(
          "@/lib/calendar-config"
        );
        const allowedCalendars = loadAllowedCalendars();

        if (allowedCalendars.length > 0) {
          actualCalendarId = decodeCalendarId(allowedCalendars[0].cid);
          console.log(
            `📅 Service account mode: Using configured calendar: ${actualCalendarId}`
          );
        } else {
          console.warn(
            "⚠️ No allowed calendars configured for service account mode"
          );
          actualCalendarId = "primary"; // Fallback to service account's own calendar
        }
      }
    }

    console.log(`📅 Final calendar ID: ${actualCalendarId}`);

    // Initialize calendar service based on authentication mode
    let calendarService: CalendarService;

    if (useServiceAccountMode) {
      // Service Account Mode: Use service account for calendar operations
      const enhancedService = await EnhancedCalendarService.createWithFallback(
        undefined,
        true
      );
      calendarService = enhancedService as unknown as CalendarService;

      if (process.env.BYPASS_GOOGLE_AUTH === "true") {
        console.log(
          "🔧 Bypass mode: Using service account authentication for calendar operations"
        );
      } else {
        console.log(
          "🔧 Using service account authentication for calendar operations"
        );
      }
    } else {
      // OAuth Mode: Use user OAuth for calendar operations
      if (!session?.accessToken) {
        return NextResponse.json(
          { error: "Authentication required - OAuth access token missing" },
          { status: 401 }
        );
      }
      const googleAuth = createGoogleAuth(
        session.accessToken,
        session.refreshToken
      );
      calendarService = new CalendarService(googleAuth);
      console.log("🔐 Using user OAuth authentication for calendar operations");
    }
    const aiService = new AIService();

    // Translate message to English if needed
    console.log("🔤 Original message:", message);
    let englishMessage = await aiService.translateToEnglish(message);
    console.log("🔤 Translated message:", englishMessage);

    // Check if translation fucked up the message
    if (
      englishMessage.includes("already in English") ||
      englishMessage.includes("text is in English")
    ) {
      console.warn("⚠️ Translation failed, using original message");
      englishMessage = message;
    }

    // Choose between tool-based approaches
    if (useTools) {
      // Check if files are uploaded and use appropriate processing method
      if (processedFiles.length > 0) {
        console.log("📁 Files detected - determining processing approach");

        try {
          const fileResponse = await aiService.processMessageWithFiles(
            englishMessage,
            model,
            processedFiles
          );

          return NextResponse.json({
            success: true,
            message: `📁 EMBEDDED FILE RESPONSE: ${fileResponse}`,
            approach: "embedded-files",
          });
        } catch (fileError) {
          console.error("File processing failed:", fileError);
          // Fall back to regular processing if file processing fails
        }
      }

      // Check if this should use the new agentic orchestrator
      if (developmentMode) {
        // NEW: Agentic orchestration approach with all tool categories
        console.log("🤖 Using AGENTIC mode with orchestrator");
        console.log("🤖 Parameters:", {
          useTools,
          developmentMode,
          model,
        });
        console.log("🤖 Message:", englishMessage);

        const calendarTools = new CalendarTools(
          calendarService,
          actualCalendarId
        );
        const emailTools = new EmailTools();
        const passportTools = new PassportTools();
        const fileSearchTools = new FileSearchTools();
        // Disabled web tools to force use of vector search for knowledge queries
        // const webTools = new WebTools();
        // const toolRegistry = createToolRegistry(calendarTools, emailTools, fileTools, webTools, passportTools);
        const toolRegistry = createToolRegistry(
          calendarTools,
          emailTools,
          undefined,
          passportTools,
          fileSearchTools
        );

        // Register knowledge tools (including vector search) for non-calendar queries
        registerKnowledgeTools(toolRegistry);

        console.log("🤖 Tool registry created, calling orchestrator...");

        // Prepare file context for orchestrator
        const result = await aiService.processMessageWithOrchestrator(
          englishMessage,
          messages || [], // Pass chat history
          toolRegistry,
          model,
          developmentMode,
          processedFiles
        );

        console.log("🤖 Orchestrator result:", {
          success: result.success,
          steps: result.steps?.length,
          toolCalls: result.toolCalls?.length,
          progressMessages: result.progressMessages?.length,
        });

        return NextResponse.json({
          success: result.success,
          message: `🤖 AGENTIC MODE RESPONSE: ${result.response}`,
          steps: result.steps,
          toolCalls: result.toolCalls,
          progressMessages: result.progressMessages,
          approach: "agentic",
          error: result.error,
        });
      } else {
        // EXISTING: Simple tool-based approach
        console.log("🔧 Using SIMPLE tool mode");
        console.log("🔧 Parameters:", { useTools, developmentMode, model });
        console.log("🔧 Message:", englishMessage);
        console.log("🔧 Calendar ID:", calendarId);

        const calendarTools = new CalendarTools(
          calendarService,
          actualCalendarId
        );

        const result = await aiService.processMessageWithTools(
          englishMessage,
          calendarTools
        );

        console.log("🔧 Simple mode result:", {
          responseLength: result.response?.length || 0,
          toolCallsCount: result.toolCalls?.length || 0,
          toolCallsDetails: result.toolCalls?.map((tc) => ({
            tool: tc.tool,
            success:
              tc.result &&
              typeof tc.result === "object" &&
              "success" in tc.result
                ? tc.result.success
                : "unknown",
          })),
        });

        return NextResponse.json({
          success: true,
          message: `🔧 SIMPLE MODE RESPONSE: ${result.response}`,
          toolCalls: result.toolCalls,
          approach: "tools",
        });
      }
    } else {
      // LEGACY: JSON-based approach for backwards compatibility
      console.log("📜 Using LEGACY JSON mode");
      return await processWithJsonApproach(
        englishMessage,
        calendarService,
        aiService,
        model,
        message
      );
    }
  } catch (error) {
    console.error("Chat API error:", error);
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
    const action = await aiService.processMessage(
      englishMessage,
      existingEvents.items,
      model
    );

    // Debug logging
    console.log("Original message:", originalMessage);
    console.log("Processed action:", JSON.stringify(action, null, 2));

    let result: CalendarEvent | CalendarEvent[] | void = undefined;
    let responseMessage = "";

    switch (action.type) {
      case "create":
        if (action.event) {
          result = await calendarService.createEvent(action.event);
          responseMessage = `✅ Created event: "${action.event.summary}"`;
        }
        break;

      case "update":
        if (action.eventId && action.event) {
          result = await calendarService.updateEvent(
            action.eventId,
            action.event
          );
          responseMessage = `✅ Updated event: "${
            action.event.summary || "Event updated"
          }"`;
        }
        break;

      case "delete":
        if (action.eventId) {
          await calendarService.deleteEvent(action.eventId);
          responseMessage = "✅ Event deleted successfully";
        }
        break;

      case "list":
        const timeMin = action.timeRange?.start || new Date().toISOString();
        const timeMax =
          action.timeRange?.end ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Extract filter keywords from the original message
        const messageLower = originalMessage.toLowerCase();
        const filterKeywords: string[] = [];

        // Common patterns to extract filter terms (company names, project names, etc.)
        const patterns = [
          /(?:for|about|regarding|related to|relative to)\s+([a-zA-Z\-_]+)/gi,
          /(?:activities for|events for|meetings for)\s+([a-zA-Z\-_]+)/gi,
          /([a-zA-Z\-_]+)\s+(?:activities|events|meetings|work|project)/gi,
          /(?:list|show|find)\s+([a-zA-Z\-_]+)\s+(?:activities|events|meetings)/gi,
        ];

        patterns.forEach((pattern) => {
          const matches = messageLower.matchAll(pattern);
          for (const match of matches) {
            if (
              match[1] &&
              match[1].length > 2 &&
              match[1] !== "all" &&
              match[1] !== "events"
            ) {
              // Avoid short words and generic terms
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
          "startTime", // orderBy
          "Asia/Makassar" // timeZone
        );

        // Apply client-side filtering if we have filter keywords
        let filteredEvents = events.items;
        if (filterKeywords.length > 0) {
          filteredEvents = events.items.filter((event) => {
            const eventText = `${event.summary || ""} ${
              event.description || ""
            }`.toLowerCase();
            return filterKeywords.some((keyword) =>
              eventText.includes(keyword)
            );
          });
        }

        result = filteredEvents;

        if (filterKeywords.length > 0) {
          responseMessage = `📅 Found ${
            filteredEvents.length
          } event(s) matching "${filterKeywords.join(", ")}"`;
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
        responseMessage =
          "I'm not sure how to help with that. Please try rephrasing your request.";
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      action: action.type,
      events: result, // Always include events for list operations
      data: result,
      approach: "legacy",
    });
  } catch (error) {
    console.error("Legacy processing error:", error);
    throw error;
  }
}

// Error handling helper
function handleApiError(error: unknown) {
  // Provide more specific error messages based on error type
  let errorMessage = "Failed to process your request. Please try again.";
  let statusCode = 500;

  if (error instanceof Error) {
    // Google Calendar API authentication errors
    if (
      error.message.includes("invalid authentication") ||
      error.message.includes("OAuth 2 access token") ||
      error.message.includes("login cookie") ||
      error.message.includes("authentication credential")
    ) {
      errorMessage =
        "Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.";
      statusCode = 401;
    }
    // Google Calendar permission errors
    else if (
      error.message.includes("insufficient permissions") ||
      (error.message.includes("calendar") && error.message.includes("access"))
    ) {
      errorMessage =
        "Insufficient Google Calendar permissions. Please ensure you have granted calendar access during sign-in.";
      statusCode = 403;
    }
    // OpenAI API errors
    else if (error.message.includes("API key")) {
      errorMessage =
        "OpenAI API key is invalid or missing. Please check your configuration.";
    } else if (error.message.includes("rate limit")) {
      errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      statusCode = 429;
    } else if (error.message.includes("model")) {
      errorMessage =
        "The selected AI model is not available. Please try a different model.";
    } else if (error.message.includes("context")) {
      errorMessage = "Request too long. Please try with a shorter message.";
    } else if (error.message.includes("quota")) {
      errorMessage = "API quota exceeded. Please check your OpenAI billing.";
    } else {
      errorMessage = `Error: ${error.message}`;
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
    },
    { status: statusCode }
  );
}
