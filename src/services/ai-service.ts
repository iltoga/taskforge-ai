import { ModelType } from "@/appconfig/models";
import { generateTextWithProvider, type AIProviderConfig } from "@/lib/openai";
import { CalendarTools } from "@/tools/calendar-tools";
import {
  CalendarAction,
  CalendarEvent,
  SimplifiedEvent,
} from "@/types/calendar";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";

import { loadAgenticPrompt, loadSystemPrompt } from "@/services/prompt-loader";
import {
  generateReport as generateReportInternal,
  generateWeeklyReport as generateWeeklyReportInternal,
} from "@/services/report-generator";
import {
  extractSearchKeyword,
  extractTimeRange,
  limitEventsContext,
} from "@/utils/event-utils";

export interface ExtractedEvent {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
}

export class AIService {
  // Delegated helper functions
  private limitEventsContext = limitEventsContext;
  private extractSearchKeyword = extractSearchKeyword;
  private extractTimeRange = extractTimeRange;
  private loadSystemPrompt = loadSystemPrompt;
  private loadAgenticPrompt = loadAgenticPrompt;

  async processMessage(
    message: string,
    existingEvents?: CalendarEvent[],
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
    providerConfig?: AIProviderConfig
  ): Promise<CalendarAction> {
    const systemPrompt = this.loadSystemPrompt();

    // Build the system message content including events if provided
    let systemContent = systemPrompt;
    if (existingEvents && existingEvents.length > 0) {
      // Limit events to prevent token overflow
      const limitedEvents = this.limitEventsContext(existingEvents);
      systemContent += `\n\nRecent events for context (${
        limitedEvents.length
      } most recent): ${JSON.stringify(limitedEvents, null, 2)}`;
    }

    try {
      const { text } = await generateTextWithProvider(
        message,
        providerConfig || {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
        },
        {
          model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: message },
          ],
        }
      );

      if (!text) {
        throw new Error("No response from AI");
      }

      // Debug logging to understand AI responses
      console.log("User message:", message);
      console.log("AI response:", text);

      // Clean up the response - handle markdown code blocks
      let cleanedContent = text.trim();

      // Remove markdown code block formatting if present
      const codeBlockMatch = cleanedContent.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      );
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }

      const action = JSON.parse(cleanedContent) as CalendarAction;

      // Additional validation
      if (action.type === "list" && !action.timeRange) {
        throw new Error("List operation requires timeRange");
      }

      return action;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Invalid JSON from AI - could not parse response");
        throw new Error("Invalid JSON response from AI");
      }
      throw error;
    }
  }

  async generateWeeklyReport(
    events: CalendarEvent[],
    company: string,
    startDate: string,
    endDate: string,
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
    userName: string = "User",
    providerConfig?: AIProviderConfig
  ): Promise<string> {
    return generateWeeklyReportInternal(
      events,
      company,
      startDate,
      endDate,
      model,
      userName,
      providerConfig
    );
  }

  async generateReport(
    events: CalendarEvent[],
    company: string,
    startDate: string,
    endDate: string,
    reportType: "weekly" | "monthly" | "quarterly",
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
    userName: string = "User",
    providerConfig?: AIProviderConfig
  ): Promise<string> {
    return generateReportInternal(
      events,
      company,
      startDate,
      endDate,
      reportType,
      model,
      userName,
      providerConfig
    );
  }

  // New method for agentic tool orchestration
  async processMessageWithOrchestrator(
    message: string,
    chatHistory: ChatHistory,
    toolRegistry: unknown,
    orchestratorModel: ModelType = (process.env
      .OPENAI_DEFAULT_MODEL as ModelType) || "gpt-5-mini",
    developmentMode: boolean = false,
    processedFiles: Array<ProcessedFile> = []
  ): Promise<{
    response: string;
    steps: unknown[];
    toolCalls: unknown[];
    progressMessages: string[];
    success: boolean;
    error?: string;
  }> {
    try {
      // Dynamic import to avoid circular dependencies
      const { ToolOrchestrator } = await import("@/services/orchestrator/core");
      const { initializeMCP } = await import("@/services/mcp/mcp-api");

      // Initialize MCP if not already done
      try {
        await initializeMCP();
      } catch (error) {
        console.warn("MCP initialization failed, continuing without MCP:", error);
      }

      const orchestrator = new ToolOrchestrator(process.env.OPENAI_API_KEY!);

      // Capture progress messages
      const progressMessages: string[] = [];
      orchestrator.setProgressCallback((message: string) => {
        progressMessages.push(message);
      });

      // Ensure processedFiles is always an array
      const safeProcessedFiles = Array.isArray(processedFiles)
        ? processedFiles
        : [];
      const result = await orchestrator.orchestrate(
        message,
        chatHistory,
        toolRegistry as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orchestratorModel,
        {
          maxSteps: 10,
          maxToolCalls: 5,
          developmentMode,
        },
        safeProcessedFiles
      );

      return {
        response: result.finalAnswer,
        steps: result.steps,
        toolCalls: result.toolCalls,
        progressMessages,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error("Orchestrator processing error:", error);
      return {
        response:
          "I encountered an error while processing your request. Please try again.",
        steps: [],
        toolCalls: [],
        progressMessages: ["💥 Orchestration failed with an error"],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Streaming method for real-time progress updates
  async processMessageWithOrchestratorStreaming(
    message: string,
    chatHistory: ChatHistory,
    toolRegistry: unknown,
    orchestratorModel: ModelType = (process.env
      .OPENAI_DEFAULT_MODEL as ModelType) || "gpt-5-mini",
    processedFiles: Array<ProcessedFile> = [],
    developmentMode: boolean = false,
    progressCallback: (data: {
      type: string;
      message?: string;
      [key: string]: unknown;
    }) => void = () => {}
  ): Promise<{
    response: string;
    steps: unknown[];
    toolCalls: unknown[];
    progressMessages: string[];
    success: boolean;
    error?: string;
  }> {
    try {
      // Dynamic import to avoid circular dependencies
      const { ToolOrchestrator } = await import("@/services/orchestrator/core");
      const { initializeMCP } = await import("@/services/mcp/mcp-api");

      // Initialize MCP if not already done
      try {
        await initializeMCP();
      } catch (error) {
        console.warn("MCP initialization failed, continuing without MCP:", error);
      }

      const orchestrator = new ToolOrchestrator(process.env.OPENAI_API_KEY!);

      // Capture progress messages and stream them in real-time
      const progressMessages: string[] = [];
      orchestrator.setProgressCallback((message: string) => {
        progressMessages.push(message);
        // Send progress update immediately
        if (typeof progressCallback === "function") {
          progressCallback({
            type: "progress",
            message: message,
          });
        }
      });

      // Ensure processedFiles is always an array
      const safeProcessedFiles = Array.isArray(processedFiles)
        ? processedFiles
        : [];
      const result = await orchestrator.orchestrate(
        message,
        chatHistory,
        toolRegistry as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orchestratorModel,
        {
          maxSteps: 10,
          maxToolCalls: 5,
          developmentMode,
        },
        safeProcessedFiles
      );

      return {
        response: result.finalAnswer,
        steps: result.steps,
        toolCalls: result.toolCalls,
        progressMessages,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error("Streaming orchestrator processing error:", error);
      if (typeof progressCallback === "function") {
        progressCallback({
          type: "progress",
          message: "💥 Orchestration failed with an error",
        });
      }

      return {
        response:
          "I encountered an error while processing your request. Please try again.",
        steps: [],
        toolCalls: [],
        progressMessages: ["💥 Orchestration failed with an error"],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Helper method to parse event creation requests
  private async parseEventCreationRequest(
    message: string
  ): Promise<CalendarEvent> {
    // Use AI to parse the event creation request
    const systemPrompt = `You are a calendar event parser. Extract event details from natural language and return a JSON object.

Today is ${new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}.
Current timezone: Asia/Makassar (+08:00)

Parse the user's request and return a JSON object with these fields:
- summary: Event title (required)
- start: { dateTime: "YYYY-MM-DDTHH:MM:SS+08:00" } for timed events OR { date: "YYYY-MM-DD" } for all-day events
- end: { dateTime: "YYYY-MM-DDTHH:MM:SS+08:00" } for timed events OR { date: "YYYY-MM-DD" } for all-day events
- location: Location if mentioned (optional)
- description: Description if mentioned (optional)

Default rules:
- If no time specified, create as all-day event
- If time specified but no duration, default to 1 hour
- If "tomorrow" is mentioned, use the next day
- If "today" is mentioned, use current date
- Use professional, clear event titles

Return ONLY the JSON object, no other text.`;

    try {
      const model =
        (process.env.OPENAI_DEFAULT_MODEL as ModelType) || "gpt-5-mini";

      const { text } = await generateTextWithProvider(
        message,
        { provider: "openai", apiKey: process.env.OPENAI_API_KEY! },
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }
      );

      const content = text?.trim() || "";

      // Clean up the response - handle markdown code blocks
      let cleanedContent = content;
      const codeBlockMatch = cleanedContent.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      );
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }

      const eventData = JSON.parse(cleanedContent) as CalendarEvent;

      // Validate required fields
      if (!eventData.summary) {
        throw new Error("Event title is required");
      }

      if (!eventData.start) {
        throw new Error("Event start time is required");
      }

      if (!eventData.end) {
        // If no end time, add 1 hour for timed events or next day for all-day events
        if (eventData.start.dateTime) {
          const startTime = new Date(eventData.start.dateTime);
          startTime.setHours(startTime.getHours() + 1);
          eventData.end = {
            dateTime: startTime.toISOString().replace("Z", "+08:00"),
          };
        } else if (eventData.start.date) {
          const startDate = new Date(eventData.start.date);
          startDate.setDate(startDate.getDate() + 1);
          eventData.end = { date: startDate.toISOString().split("T")[0] };
        }
      }

      return eventData;
    } catch (error) {
      console.error("Error parsing event creation request:", error);
      throw new Error(
        `Failed to parse event details: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async processMessageWithTools(
    message: string,
    calendarTools: CalendarTools
  ): Promise<{
    response: string;
    toolCalls: Array<{ tool: string; result: unknown }>;
  }> {
    console.log("🔧 SIMPLE MODE: Processing message with tools:", message);

    // For now, let's implement a simpler approach that manually calls tools based on message analysis
    const toolCalls: Array<{ tool: string; result: unknown }> = [];
    let response = "";

    try {
      // Analyze the message to determine what tools to use
      const messageLower = message.toLowerCase();
      console.log("🔧 SIMPLE MODE: Message keywords analysis:", {
        hasSummarize: messageLower.includes("summarize"),
        hasEvents: messageLower.includes("events"),
        hasList: messageLower.includes("list"),
        hasShow: messageLower.includes("show"),
        hasPast: messageLower.includes("past"),
        hasReport: messageLower.includes("report"),
        hasActivities: messageLower.includes("activities"),
        hasCalendar: messageLower.includes("calendar"),
      });

      if (
        messageLower.includes("summarize") ||
        messageLower.includes("events") ||
        messageLower.includes("list") ||
        messageLower.includes("show") ||
        messageLower.includes("past") ||
        messageLower.includes("report") ||
        messageLower.includes("activities")
      ) {
        console.log(
          "🔧 SIMPLE MODE: Detected event query - proceeding with calendar tools"
        );
        // This is a query for events
        let toolResult;

        if (messageLower.includes("nespola")) {
          // Search for techoneevents
          const timeRange = this.extractTimeRange(message);
          toolResult = await calendarTools.searchEvents("nespola", timeRange);
          toolCalls.push({ tool: "searchEvents", result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as SimplifiedEvent[];
            if (events.length > 0) {
              // Use AI to generate a proper summary of Techcorpevents
              response = await this.generateEventSummary(
                events,
                message,
                "Nespola-related"
              );
            } else {
              response =
                "I didn't find any events related to Techcorpin the specified time period.";
            }
          } else {
            response = `I tried to search for techoneevents but encountered an issue: ${
              toolResult.message || "Unknown error"
            }`;
          }
        } else if (
          messageLower.includes("search") &&
          (messageLower.includes("keyword") || messageLower.includes("term"))
        ) {
          // Extract search keyword from message
          const searchKeyword = this.extractSearchKeyword(message);
          if (searchKeyword) {
            const timeRange = this.extractTimeRange(message);
            toolResult = await calendarTools.searchEvents(
              searchKeyword,
              timeRange
            );
            toolCalls.push({ tool: "searchEvents", result: toolResult });

            if (toolResult.success && Array.isArray(toolResult.data)) {
              const events = toolResult.data as SimplifiedEvent[];
              if (events.length > 0) {
                response = await this.generateEventSummary(
                  events,
                  message,
                  `events matching "${searchKeyword}"`
                );
              } else {
                response = `I didn't find any events matching "${searchKeyword}" in the specified time period.`;
              }
            } else {
              response = `I tried to search for events matching "${searchKeyword}" but encountered an issue: ${
                toolResult.message || "Unknown error"
              }`;
            }
          } else {
            response =
              "I couldn't identify a search keyword in your request. Please specify what you'd like me to search for.";
          }
        } else {
          // General event listing/summarization
          console.log(
            "🔧 SIMPLE MODE: Using general event listing/summarization path"
          );
          const timeRange = this.extractTimeRange(message);
          console.log("🔧 SIMPLE MODE: Extracted time range:", timeRange);

          toolResult = await calendarTools.getEvents(timeRange);
          console.log("🔧 SIMPLE MODE: getEvents result:", {
            success: toolResult.success,
            dataLength: Array.isArray(toolResult.data)
              ? toolResult.data.length
              : "not array",
            message: toolResult.message,
            error: toolResult.error,
          });

          toolCalls.push({ tool: "getEvents", result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as SimplifiedEvent[];
            if (events.length > 0) {
              console.log(
                "🔧 SIMPLE MODE: Found",
                events.length,
                "events, generating summary"
              );
              console.log(
                "🔧 SIMPLE MODE: Event data sample:",
                JSON.stringify(events.slice(0, 2), null, 2)
              );
              // Use AI to generate a proper summary based on the request
              response = await this.generateEventSummary(
                events,
                message,
                "your calendar events"
              );
            } else {
              console.log("🔧 SIMPLE MODE: No events found in time period");
              response =
                "I didn't find any events in the specified time period.";
            }
          } else {
            console.log(
              "🔧 SIMPLE MODE: getEvents failed:",
              toolResult.error || toolResult.message
            );
            response = `I tried to get your events but encountered an issue: ${
              toolResult.message || toolResult.error || "Unknown error"
            }`;
          }
        }
      } else if (
        messageLower.includes("create") ||
        messageLower.includes("schedule") ||
        messageLower.includes("add") ||
        messageLower.includes("book") ||
        messageLower.includes("plan")
      ) {
        // This is a request to create an event
        try {
          const eventData = await this.parseEventCreationRequest(message);
          const toolResult = await calendarTools.createEvent(eventData);
          toolCalls.push({ tool: "createEvent", result: toolResult });

          if (toolResult.success) {
            response = `✅ Successfully created event: "${eventData.summary}"`;
            if (eventData.start?.dateTime) {
              const startDate = new Date(eventData.start.dateTime);
              response += `\n📅 Date: ${startDate.toLocaleDateString()}`;
              response += `\n🕒 Time: ${startDate.toLocaleTimeString()}`;
            } else if (eventData.start?.date) {
              response += `\n📅 Date: ${new Date(
                eventData.start.date
              ).toLocaleDateString()} (All day)`;
            }
            if (eventData.location) {
              response += `\n📍 Location: ${eventData.location}`;
            }
          } else {
            response = `❌ Failed to create event: ${
              toolResult.error || "Unknown error"
            }`;
          }
        } catch (parseError) {
          response = `❌ I couldn't understand the event details from your request. Please provide more specific information like the event title, date, and time. Error: ${
            parseError instanceof Error
              ? parseError.message
              : "Unknown parsing error"
          }`;
        }
      } else {
        // General response
        console.log(
          "🔧 SIMPLE MODE: No matching keywords - returning general response"
        );
        response =
          "I understand your request, but I'm not sure how to help with that specific calendar operation yet. For calendar operations, try using words like 'summarize', 'list', 'show', 'events', or 'activities'.";
      }

      console.log(
        "🔧 SIMPLE MODE: Final response:",
        response.substring(0, 200)
      );
      return {
        response,
        toolCalls,
      };
    } catch (error) {
      console.error("🔧 SIMPLE MODE: Tool-based processing error:", error);
      return {
        response:
          "I encountered an error while processing your request. Please try again. Error details: " +
          (error instanceof Error ? error.message : "Unknown error"),
        toolCalls,
      };
    }
  }

  // Helper method to generate AI-powered event summaries
  private async generateEventSummary(
    events: SimplifiedEvent[],
    originalMessage: string,
    contextDescription: string
  ): Promise<string> {
    console.log(
      "🔧 SIMPLE MODE: generateEventSummary called with",
      events.length,
      "events"
    );
    console.log(
      "🔧 SIMPLE MODE: First event sample:",
      JSON.stringify(events[0], null, 2)
    );

    const systemPrompt = `You are a calendar assistant that creates helpful summaries of calendar events.

Given a list of calendar events and the user's original request, create a well-formatted response that:
1. Acknowledges what was found
2. Provides a clear, organized summary
3. Highlights important details like dates, times, locations
4. Matches the tone and intent of the user's request

Format your response using markdown for readability. Use bullet points, headers, or numbered lists as appropriate.
If the user asked for a summary or report, provide an analytical overview.
If they asked to list events, provide a clear list format.
If they asked about past events, focus on what happened.

Be helpful, concise, and professional.`;

    const userPrompt = `Original user request: "${originalMessage}"

Context: Found ${events.length} ${contextDescription}

Calendar Events:
${events
  .map((event, index) => {
    // SimplifiedEvent has title, startDate, endDate directly
    const title = event.title || "Untitled Event";
    const startDate = event.startDate;
    const endDate = event.endDate;

    console.log(`🔧 Event ${index + 1} mapping:`, {
      title,
      startDate,
      endDate,
      isAllDay: event.isAllDay,
    });

    if (!startDate) {
      console.warn(`🔧 No startDate found for event ${index + 1}:`, event);
      return `${index + 1}. ${title} - Date unknown`;
    }

    const date = new Date(startDate);
    const time =
      !event.isAllDay && startDate.includes("T")
        ? ` at ${date.toLocaleTimeString()}`
        : "";
    const location = event.location ? ` (Location: ${event.location})` : "";
    const description = event.description
      ? `\n   Description: ${event.description}`
      : "";

    return `${
      index + 1
    }. ${title} - ${date.toLocaleDateString()}${time}${location}${description}`;
  })
  .join("\n")}

Please create an appropriate response based on the user's request.`;

    console.log(
      "🔧 SIMPLE MODE: Generated prompt for AI:",
      userPrompt.substring(0, 500) + "..."
    );

    try {
      const model =
        (process.env.OPENAI_DEFAULT_MODEL as ModelType) || "gpt-5-mini";

      const { text } = await generateTextWithProvider(
        userPrompt,
        { provider: "openai", apiKey: process.env.OPENAI_API_KEY! },
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }
      );

      const aiText = text;
      console.log(
        "🔧 SIMPLE MODE: AI response for summary:",
        aiText?.substring(0, 200) + "..."
      );
      return aiText || `I found ${events.length} ${contextDescription}.`;
    } catch (error) {
      console.error("Error generating event summary:", error);
      // Fallback to simple list format
      let fallback = `I found ${events.length} ${contextDescription}:\n\n`;
      events.forEach((event, index) => {
        const title = event.title || "Untitled Event";
        const startDate = event.startDate || "Unknown date";
        fallback += `${index + 1}. **${title}** - ${new Date(
          startDate
        ).toLocaleDateString()}\n`;
        if (event.description) {
          fallback += `   ${event.description}\n`;
        }
        fallback += "\n";
      });
      return fallback;
    }
  }

  async translateToEnglish(
    text: string,
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
    providerConfig?: AIProviderConfig
  ): Promise<string> {
    // If text is already in English or looks like English, don't translate
    const englishPattern = /^[a-zA-Z0-9\s.,!?'"()/-]+$/;
    if (englishPattern.test(text) && text.split(" ").length > 1) {
      return text; // Skip translation for English text
    }

    const systemPrompt = `Translate the following text to English. If the text is already in English, return it EXACTLY as provided without any modifications or comments about the language.`;

    try {
      const { text: translatedText } = await generateTextWithProvider(
        text,
        providerConfig || {
          provider: "openai",
          apiKey: process.env.OPENAI_API_KEY!,
        },
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }
      );

      return translatedText || text;
    } catch (error) {
      console.error("Translation error:", error);
      return text; // Return original text on error
    }
  }

  async analyzeImageForEvents(): Promise<ExtractedEvent[]> {
    // Vision API not supported in official OpenAI Node SDK as of 2025-07
    throw new Error(
      "Vision/image analysis is not supported by the official OpenAI Node SDK."
    );
  }

  // Method for processing messages with uploaded files using OpenAI Assistant API
  async processMessageWithFiles(
    message: string,
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
    processedFiles?: Array<ProcessedFile>
  ): Promise<string> {
    try {
      if (!processedFiles || processedFiles.length === 0) {
        return "No files were provided for analysis.";
      }

      // these two lines are just for informational purposes, not used in the actual processing
      const imageFiles = processedFiles.filter((file) => file.isImage !== null);

      const docFiles = processedFiles.filter((file) => !file.isImage !== null);
      // docs to be processed as images
      const docsToProcessAsImages = docFiles.filter(
        (file) => file.processAsImage
      );
      console.log(
        `🗃️ Processing message with ${imageFiles.length} image files, ${docFiles.length} document files, and ${docsToProcessAsImages.length} documents to be processed as images:`,
        { imageFiles, docFiles, docsToProcessAsImages }
      );

      // Import FileSearchTool
      const { FileSearchService } = await import(
        "@/services/file-search-service"
      );

      // Create and initialize the file search tool with provider config
      const fileSearchService = new FileSearchService(model);

      try {
        console.log("📋 AIService: About to initialize file search tool...");
        console.log("📋 AIService: Model to use:", model);

        // Provide more specific instructions based on the user's query
        const isContentDescriptionQuery =
          message.toLowerCase().includes("what") &&
          (message.toLowerCase().includes("see") ||
            message.toLowerCase().includes("show") ||
            message.toLowerCase().includes("find") ||
            message.toLowerCase().includes("content"));

        const isContentAuthenticityQuery =
          message.toLowerCase().includes("authenticity") ||
          message.toLowerCase().includes("authentic") ||
          message.toLowerCase().includes("real") ||
          message.toLowerCase().includes("genuine") ||
          message.toLowerCase().includes("verify") ||
          message.toLowerCase().includes("legitimacy") ||
          message.toLowerCase().includes("original") ||
          message.toLowerCase().includes("fraud") ||
          message.toLowerCase().includes("counterfeit") ||
          message.toLowerCase().includes("forgery") ||
          message.toLowerCase().includes("scam") ||
          message.toLowerCase().includes("fraudulent") ||
          message.toLowerCase().includes("fake");

        let customInstructions = isContentDescriptionQuery
          ? "You are a document analysis expert. When asked what you see in a file, provide a detailed, comprehensive description of ALL visible content including:\n" +
            "- All text, names, numbers, dates, and addresses\n" +
            "- Document type, format, and structure\n" +
            "- Any official markings, stamps, logos, or signatures\n" +
            "- Tables, forms, or organized data\n" +
            "- Images or visual elements\n" +
            "- Any other notable details or information visible in the document.\n" +
            "Be thorough and specific - list actual content rather than generic descriptions.\n"
          : "You are a helpful assistant that analyzes uploaded files and provides context-aware responses.\n" +
            "Search through the file contents to find relevant information that helps answer the user's question.\n";

        // add terms about document authenticity
        if (isContentAuthenticityQuery) {
          customInstructions +=
            "Additionally, focus on verifying the authenticity of the document by checking for:\n" +
            "- Watermarks or security features\n" +
            "- Consistency of information (e.g., dates, names)\n" +
            "- Any signs of tampering or alteration\n" +
            "- Cross-referencing with known authentic documents\n";
        }

        // Since we only have file IDs, we cannot determine image vs document types here
        // All file IDs will be treated as documents for file_search
        // For proper image/document separation, use processMessageWithEmbeddedFiles instead
        await fileSearchService.initialize(
          customInstructions,
          model,
          processedFiles
        );
        console.log(
          "✅ AIService: File search tool initialized successfully with document files"
        );

        console.log(
          "🔍 AIService: File search tool initialized, starting search..."
        );
        const searchResult = await fileSearchService.searchFiles(message);
        console.log("🔍 AIService: Search completed, processing results...");

        console.log("📊 Search results received:", {
          hasResults: !!(searchResult && searchResult.content.length > 0),
          firstResultPreview:
            searchResult?.content?.[0]?.substring(0, 200) || "No content",
        });

        // CRITICAL: Check if file search actually worked
        if (!searchResult || searchResult.content.length === 0) {
          console.error(
            "❌ CRITICAL ERROR: File search returned no results - this indicates a failure in processing"
          );
          throw new Error(
            "File search failed to process the uploaded files. The file may not be readable or there was an API error."
          );
        }

        if (searchResult && searchResult.content.length > 0) {
          const fileCount = processedFiles.length;
          const fileWord = fileCount === 1 ? "file" : "files";

          // Format the response with file search results
          let response = `I've analyzed your uploaded ${fileWord} and found relevant information for your question: "${message}"\n\n`;

          response += "## 📄 Analysis Results\n\n";

          response += `### From ${searchResult.filename}\n`;
          response += `${searchResult.content}\n`;
          // add a separator for clarity
          response += "---\n";

          if (searchResult.relevance && searchResult.relevance < 1.0) {
            response += `*Relevance: ${Math.round(
              searchResult.relevance * 100
            )}%*\n`;
          }

          response += "---\n\n";
          response += "💡 **How to use this information:**\n";
          response +=
            "- You can ask follow-up questions about the file contents\n";
          response += "- Request specific details or clarifications\n";
          response +=
            "- Ask me to create calendar events based on the file information\n";
          response += "- Upload additional files for comparison or context\n\n";

          response += `✅ Successfully analyzed ${fileCount} ${fileWord} using file search tool.`;

          return response;
        } else {
          const fileCount = processedFiles.length;
          const fileWord = fileCount === 1 ? "file" : "files";

          return (
            `I've processed your uploaded ${fileWord}, but I couldn't find specific information related to your question: "${message}"\n\n` +
            "This could mean:\n" +
            "- The question might not be directly addressed in the uploaded files\n" +
            "- The files might need more processing time\n" +
            "- Try rephrasing your question or asking about different aspects\n\n" +
            "You can:\n" +
            "- Ask more general questions about the file contents\n" +
            "- Upload additional relevant files\n" +
            "- Use other calendar assistant features while I continue processing\n\n" +
            `📁 Files processed: ${fileCount} ${fileWord}`
          );
        }
      } finally {
        // Clean up resources
        console.log("🧹 Cleaning up file search resources...");
        fileSearchService.cleanup();
      }
    } catch (error) {
      console.error("File processing error:", error);

      // Provide a helpful error message to the user
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return (
        `❌ **File Analysis Error**\n\n` +
        `I encountered an issue while analyzing your uploaded files: ${errorMessage}\n\n` +
        `**Possible solutions:**\n` +
        `- Check if the files are in a supported format (PDF, TXT, DOCX, etc.)\n` +
        `- Try uploading smaller files or fewer files at once\n` +
        `- Ensure files contain readable text content\n` +
        `- Try again in a few moments\n\n` +
        `**Alternative:** You can still use the regular chat features for calendar management while I work on resolving this issue.`
      );
    }
  }
}
