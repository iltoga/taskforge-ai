/**
 * @openapi
 * /api/chat/stream:
 *   post:
 *     summary: "Stream chat responses"
 *     description: |
 *       Provides streaming chat responses with AI assistant and tool integration. Supports agentic orchestration and real-time conversation flows.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: "User message"
 *               messages:
 *                 type: array
 *                 description: "Chat history"
 *                 items:
 *                   type: object
 *               useTools:
 *                 type: boolean
 *                 description: "Enable tool usage (default: false)"
 *               orchestratorModel:
 *                 type: string
 *                 description: "AI model for orchestration (default: gpt-5-mini)"
 *               developmentMode:
 *                 type: boolean
 *                 description: "Enable development features (default: false)"
 *               calendarId:
 *                 type: string
 *                 description: "Calendar ID (default: primary)"
 *               processedFiles:
 *                 type: array
 *                 description: "Previously processed files"
 *                 items:
 *                   type: object
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: "Streaming response"
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: "Authentication required or expired"
 *       500:
 *         description: "Internal server error"
 */
import { ModelType } from "@/appconfig/models";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";
import { EnhancedCalendarService } from "@/services/enhanced-calendar-service";
import { CalendarTools } from "@/tools/calendar-tools";
import { EmailTools } from "@/tools/email-tools";
import { FileSearchTools } from "@/tools/file-search-tools";
import { PassportTools } from "@/tools/passport-tools";
import { createToolRegistry } from "@/tools/tool-registry";
import { createGoogleAuth } from "../../../../../auth";
// import { WebTools } from '@/tools/web-tools'; // Disabled to force vector search usage
import { registerKnowledgeTools } from "@/tools/knowledge-tools";
import { WebTools } from "@/tools/web-tools";
import { ProcessedFile } from "@/types/files";
import { auth } from "../../../../../auth";
import { ExtendedSession } from "../../../../types/auth";

export async function POST(request: Request) {
  try {
    const session = (await auth()) as ExtendedSession;

    // Determine auth preference (service account vs user OAuth)
    const preferServiceAccount =
      process.env.BYPASS_GOOGLE_AUTH === "true" ||
      process.env.CALENDAR_AUTH_MODE === "service-account";

    // Check for token refresh errors only when relying on user OAuth
    if (!preferServiceAccount && session?.error === "RefreshAccessTokenError") {
      return new Response(
        JSON.stringify({
          error:
            "Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      message,
      messages,
      useTools = false,
      orchestratorModel = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
        "gpt-5-mini",
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
      useTools?: boolean;
      orchestratorModel?: ModelType;
      developmentMode?: boolean;
      calendarId?: string;
      fileIds?: string[];
      processedFiles?: Array<ProcessedFile>;
    };

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let effectiveCalendarId = calendarId;
    console.log(`📅 Requested calendar: ${calendarId}`);

    // Enforce configured calendar in bypass or service-account mode
    const useBypass = process.env.BYPASS_GOOGLE_AUTH === "true";
    const isServiceAccountEnv =
      process.env.CALENDAR_AUTH_MODE === "service-account";
    if (
      (useBypass || isServiceAccountEnv) &&
      effectiveCalendarId === "primary"
    ) {
      try {
        const { loadAllowedCalendars, decodeCalendarId } = await import(
          "@/lib/calendar-config"
        );
        const allowed = loadAllowedCalendars();
        if (allowed.length > 0) {
          const decoded = decodeCalendarId(allowed[0].cid);
          effectiveCalendarId = decoded || effectiveCalendarId;
          console.log(
            `📅 Stream: Enforcing configured calendar: ${effectiveCalendarId}`
          );
        }
      } catch (e) {
        console.warn("Stream route: failed to resolve configured calendar", e);
      }
    } else if (effectiveCalendarId === "primary") {
      // If service account is available, prefer configured calendars as a conservative default
      try {
        const { isServiceAccountAvailable } = await import("@/lib/auth");
        if (isServiceAccountAvailable()) {
          const { loadAllowedCalendars, decodeCalendarId } = await import(
            "@/lib/calendar-config"
          );
          const allowed = loadAllowedCalendars();
          if (allowed.length > 0) {
            const decoded = decodeCalendarId(allowed[0].cid);
            effectiveCalendarId = decoded || effectiveCalendarId;
            console.log(
              `📅 Stream: Service account available, using configured calendar: ${effectiveCalendarId}`
            );
          }
        }
      } catch (e) {
        console.warn("Stream route: failed to resolve configured calendar", e);
      }
    }

    // Only stream for agentic mode
    if (!useTools || !developmentMode) {
      return new Response(
        JSON.stringify({ error: "Streaming only available for agentic mode" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize calendar service with automatic fallback
    let primaryAuth: import("google-auth-library").OAuth2Client | undefined;
    if (session?.accessToken) {
      primaryAuth = createGoogleAuth(session.accessToken, session.refreshToken);
    }

    let calendarService: CalendarService;
    try {
      const enhanced = await EnhancedCalendarService.createWithFallback(
        primaryAuth,
        preferServiceAccount
      );
      calendarService = enhanced as unknown as CalendarService;
      console.log(
        `🔐 Stream calendar auth: ${enhanced.getAuthType()} (preferSA=${preferServiceAccount})`
      );
    } catch {
      // If we failed to create any auth client, require authentication
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
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

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Function to send progress updates
        const sendProgress = (data: {
          type: string;
          message?: string;
          [key: string]: unknown;
        }) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Start orchestration with progress streaming
        (async () => {
          try {
            console.log(
              "🌊 Starting streaming orchestration for:",
              englishMessage
            );

            const calendarTools = new CalendarTools(
              calendarService,
              effectiveCalendarId
            );
            const emailTools = new EmailTools();
            const passportTools = new PassportTools();
            const fileSearchTools = new FileSearchTools();
            // Disabled web tools to force use of vector search for knowledge queries
            const webTools = new WebTools();

            const toolRegistry = createToolRegistry(
              calendarTools,
              emailTools,
              webTools,
              passportTools,
              fileSearchTools
            );

            // Register knowledge tools (including vector search) for non-calendar queries
            registerKnowledgeTools(toolRegistry);

            // Process with streaming progress
            const result =
              await aiService.processMessageWithOrchestratorStreaming(
                englishMessage,
                messages || [],
                toolRegistry,
                orchestratorModel,
                processedFiles,
                developmentMode
              );

            // Send final result
            console.log("📤🔥 Sending final result:", {
              success: result.success,
              messageLength: result.response?.length || 0,
              hasSteps: !!result.steps?.length,
              hasToolCalls: !!result.toolCalls?.length,
              actualResponse: result.response?.substring(0, 200),
              fullResult: JSON.stringify(result, null, 2),
            });

            const finalData = {
              type: "final",
              success: result.success,
              message: result.response,
              steps: result.steps,
              toolCalls: result.toolCalls,
              progressMessages: result.progressMessages,
              approach: "agentic",
              error: result.error,
            };

            console.log(
              "📤🔥 FINAL DATA BEING SENT:",
              JSON.stringify(finalData, null, 2)
            );

            sendProgress(finalData);

            controller.close();
          } catch (error) {
            console.error("Streaming orchestration error:", error);
            sendProgress({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            });
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
