import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { compile } from 'handlebars';
import { join } from 'path';
import { ModelType } from '../appconfig/models';
import { CalendarTools } from '../tools/calendar-tools';
import { CalendarAction, CalendarEvent, SimplifiedEvent } from '../types/calendar';

export type ProviderType = 'openai' | 'openrouter';

export interface AIProviderConfig {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
}

export interface ExtractedEvent {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
}

export class AIService {
  private apiKey: string;
  private openaiClient: ReturnType<typeof createOpenAI>;
  private openrouterClient?: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openaiClient = createOpenAI({
      apiKey: apiKey,
    });

    // Initialize OpenRouter client if API key is available
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (openrouterApiKey) {
      this.openrouterClient = createOpenAI({
        apiKey: openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
  }

  private getProviderClient(model: ModelType) {
    // Determine provider based on model
    if (model.includes('/') || model.includes(':')) {
      // OpenRouter model format (e.g., "deepseek/deepseek-chat-v3-0324:free")
      if (!this.openrouterClient) {
        throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment variables.');
      }
      return this.openrouterClient;
    }

    // Default to OpenAI for standard models
    return this.openaiClient;
  }

  // Limit context to prevent token overflow
  private limitEventsContext(events: CalendarEvent[], maxEvents: number = 20): CalendarEvent[] {
    // Sort by date (most recent first) and limit
    return events
      .filter(event => event.start) // Filter out events without start time
      .sort((a, b) => {
        const dateA = new Date(a.start?.dateTime || a.start?.date || '').getTime();
        const dateB = new Date(b.start?.dateTime || b.start?.date || '').getTime();
        return dateB - dateA;
      })
      .slice(0, maxEvents);
  }

  // Load system prompt from external template file
  private loadSystemPrompt(): string {
    try {
      const promptPath = join(process.cwd(), 'prompts', 'calendar-assistant.md');
      const templateContent = readFileSync(promptPath, 'utf-8');
      const template = compile(templateContent);
      // Get timezone from environment variable or default to 'Asia/Makassar'
      const timezoneEnv = process.env.TIMEZONE || 'Asia/Makassar';
      const timezoneOffset = process.env.TIMEZONE_OFFSET || '+08:00';
      let prompt = template({
        TIMEZONE: timezoneEnv,
        TIMEZONE_OFFSET: timezoneOffset,
        CURRENT_DATE: new Date().toLocaleDateString('en-US', {
          timeZone: timezoneEnv,
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      });

      // Add current date to the prompt
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Insert the current date statement at the beginning of the prompt
      prompt = `Today is ${formattedDate}.\n\n${prompt}`;

      return prompt;
    } catch (error) {
      console.error('Error loading system prompt template:', error);
      // Fallback to a basic prompt if file loading fails
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return `Today is ${formattedDate}.\n\nYou are Calendar Assistant, a digital assistant for managing Google Calendar events. Always respond with valid JSON only.`;
    }
  }

  // Load agentic tool mode system prompt
  private loadAgenticPrompt(): string {
    try {
      const promptPath = join(process.cwd(), 'prompts', 'agentic-tool-mode.md');
      let prompt = readFileSync(promptPath, 'utf-8');

      // Add current date to the prompt
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Insert the current date statement at the beginning of the prompt
      prompt = `Today is ${formattedDate}.\n\n${prompt}`;

      return prompt;
    } catch (error) {
      console.error('Error loading agentic prompt template:', error);
      // Fallback to a basic prompt if file loading fails
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return `Today is ${formattedDate}.\n\nYou are Calendar Assistant, a digital assistant for managing Google Calendar events with access to tools.`;
    }
  }

  async processMessage(
    message: string,
    existingEvents?: CalendarEvent[],
    model: ModelType = 'gpt-4.1-mini'
  ): Promise<CalendarAction> {
    const systemPrompt = this.loadSystemPrompt();

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: message }
    ];

    if (existingEvents && existingEvents.length > 0) {
      // Limit events to prevent token overflow
      const limitedEvents = this.limitEventsContext(existingEvents);
      messages.push({
        role: 'system' as const,
        content: `Recent events for context (${limitedEvents.length} most recent): ${JSON.stringify(limitedEvents, null, 2)}`
      });
    }

    try {
      // Use temperature only for models that support it (some reasoning models don't support temperature)
      const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);
      const client = this.getProviderClient(model);

      const response = await generateText({
        model: client.languageModel(model),
        messages,
        ...(supportsTemperature && { temperature: 0.1 }),
      });

      const content = response.text;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Debug logging to understand AI responses
      console.log('User message:', message);
      console.log('AI response:', content);

      // Clean up the response - handle markdown code blocks
      let cleanedContent = content.trim();

      // Remove markdown code block formatting if present
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }

      const action = JSON.parse(cleanedContent) as CalendarAction;

      // Additional validation
      if (action.type === 'list' && !action.timeRange) {
        throw new Error('List operation requires timeRange');
      }

      return action;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error('Invalid JSON from AI - could not parse response');
        throw new Error('Invalid JSON response from AI');
      }
      throw error;
    }
  }

  async generateWeeklyReport(events: CalendarEvent[], company: string, startDate: string, endDate: string, model: ModelType = 'gpt-4.1-mini', userName: string = 'User'): Promise<string> {
    return this.generateReport(events, company, startDate, endDate, 'weekly', model, userName);
  }

  async generateReport(
    events: CalendarEvent[],
    company: string,
    startDate: string,
    endDate: string,
    reportType: 'weekly' | 'monthly' | 'quarterly',
    model: ModelType = 'gpt-4.1-mini',
    userName: string = 'User'
  ): Promise<string> {
    const getSystemPrompt = (type: 'weekly' | 'monthly' | 'quarterly') => {
      const companyText = company ? ` for ${company}` : '';

      switch (type) {
        case 'weekly':
          return `
You are tasked with generating a detailed weekly activity report for ${userName} (just use the first name in all instances).
Format the output as follows:

${userName}'s Weekly Activity Report${companyText} - [start date / end date]

For each day with events, list:
**[Day, Date]:**
• [Activity 1]
• [Activity 2]
...
• [Activity n]

If no events occurred on a day, simply state:
**[Day, Date]: No significant activities**

At the end, add:
**Summary:**
[Brief summary emphasizing main focus and achievements, if the events are related to work, else summarize personal activities]

Use professional, concise language and improve grammar/formatting of the original activities with a focus on clarity and readability.
`;

        case 'monthly':
          return `
You are tasked with generating a comprehensive monthly activity report for ${userName}.
Format the output as follows:

${userName}'s Monthly Activity Report${companyText} - [start date / end date]

**Key Activities by Week:**
Week 1 ([dates]):
• [Major activities and achievements]

Week 2 ([dates]):
• [Major activities and achievements]

Week 3 ([dates]):
• [Major activities and achievements]

Week 4 ([dates]):
• [Major activities and achievements]

**Monthly Highlights:**
• [Key accomplishments]
• [Important meetings/projects]
• [Notable outcomes]

**Summary:**
[Comprehensive summary of the month's work, focusing on major achievements, project progress, and impact, if the events are related to work, else summarize personal activities in a more informal tone]

- Use professional, strategic language and focus on high-level outcomes and achievements in case of work-related events and improve grammar/formatting of the original activities with a focus on clarity and readability.
- If the events are personal, use a more informal tone summarizing personal activities.
`;

        case 'quarterly':
          return `
You are tasked with generating a strategic quarterly activity report for ${userName}.
Format the output as follows:

${userName}'s Quarterly Activity Report${companyText} - [start date / end date]

**Month 1 Overview:**
• [Key accomplishments and focus areas]

**Month 2 Overview:**
• [Key accomplishments and focus areas]

**Month 3 Overview:**
• [Key accomplishments and focus areas]

**Quarterly Achievements:**
• [Major project completions]
• [Strategic initiatives]
• [Key relationships built]
• [Process improvements]

**Impact & Outcomes:**
• [Business impact]
• [Team contributions]
• [Client/stakeholder value delivered]

**Summary:**
[Executive-level summary focusing on strategic impact, growth, and long-term value creation]

- Use executive-level language focusing on strategic impact, business outcomes, and long-term value creation if the events are related to work.
- Else summarize personal activities in a more informal tone.
`;

        default:
          return `Generate a ${type} work report for ${userName}${companyText}.`;
      }
    };

    const getUserPrompt = (type: 'weekly' | 'monthly' | 'quarterly') => {
      const companyText = company ? ` for ${company}` : '';

      return `
Generate a ${type} work report${companyText} from ${startDate} to ${endDate}.

Events data:
${events.map(event => {
  const eventDate = event.start?.date || event.start?.dateTime;
  const eventTitle = event.summary || 'Untitled Event';
  const eventDescription = event.description || '';
  const eventLocation = event.location ? ` (Location: ${event.location})` : '';

  return `Date: ${eventDate}, Event: ${eventTitle}${eventLocation}, Details: ${eventDescription}`;
}).join('\n')}

Total events in period: ${events.length}
`;
    };

    const systemPrompt = getSystemPrompt(reportType);
    const userPrompt = getUserPrompt(reportType);

    try {
      // Use temperature only for models that support it (some reasoning models don't support temperature)
      const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);
      const client = this.getProviderClient(model);

      const response = await generateText({
        model: client.languageModel(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        ...(supportsTemperature && { temperature: 0.3 }),
      });

      return response.text || '';
    } catch (error) {
      throw error;
    }
  }

  // New method for agentic tool orchestration
  async processMessageWithOrchestrator(
    message: string,
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    toolRegistry: unknown,
    orchestratorModel: ModelType = 'gpt-4.1-mini',
    developmentMode: boolean = false,
    fileIds: string[] = [],
    fileContext?: {
      type: 'processedFiles' | 'fileIds';
      files?: Array<{ fileName: string; fileContent: string; fileSize: number; }>;
      ids?: string[];
    }
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
      const { ToolOrchestrator } = await import('./tool-orchestrator');

      const orchestrator = new ToolOrchestrator(this.apiKey);

      // Capture progress messages
      const progressMessages: string[] = [];
      orchestrator.setProgressCallback((message: string) => {
        progressMessages.push(message);
      });

      // Determine which files to pass to orchestrator
      const orchestratorFileIds = fileContext?.type === 'processedFiles'
        ? fileContext.files?.map(f => `processed:${f.fileName}`) || []
        : fileIds;

      const result = await orchestrator.orchestrate(
        message,
        chatHistory,
        toolRegistry as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orchestratorModel,
        {
          maxSteps: 10,
          maxToolCalls: 5,
          developmentMode
        },
        orchestratorFileIds
      );

      return {
        response: result.finalAnswer,
        steps: result.steps,
        toolCalls: result.toolCalls,
        progressMessages,
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('Orchestrator processing error:', error);
      return {
        response: "I encountered an error while processing your request. Please try again.",
        steps: [],
        toolCalls: [],
        progressMessages: ['💥 Orchestration failed with an error'],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Streaming method for real-time progress updates
  async processMessageWithOrchestratorStreaming(
    message: string,
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    toolRegistry: unknown,
    orchestratorModel: ModelType = 'gpt-4.1-mini',
    developmentMode: boolean = false,
    progressCallback: (data: { type: string; message?: string; [key: string]: unknown }) => void,
    fileIds: string[] = []
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
      const { ToolOrchestrator } = await import('./tool-orchestrator');

      const orchestrator = new ToolOrchestrator(this.apiKey);

      // Capture progress messages and stream them in real-time
      const progressMessages: string[] = [];
      orchestrator.setProgressCallback((message: string) => {
        progressMessages.push(message);
        // Send progress update immediately
        progressCallback({
          type: 'progress',
          message: message
        });
      });

      const result = await orchestrator.orchestrate(
        message,
        chatHistory,
        toolRegistry as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orchestratorModel,
        {
          maxSteps: 10,
          maxToolCalls: 5,
          developmentMode
        },
        fileIds
      );

      return {
        response: result.finalAnswer,
        steps: result.steps,
        toolCalls: result.toolCalls,
        progressMessages,
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('Streaming orchestrator processing error:', error);
      progressCallback({
        type: 'progress',
        message: '💥 Orchestration failed with an error'
      });

      return {
        response: "I encountered an error while processing your request. Please try again.",
        steps: [],
        toolCalls: [],
        progressMessages: ['💥 Orchestration failed with an error'],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to parse event creation requests
  private async parseEventCreationRequest(message: string): Promise<CalendarEvent> {
    // Use AI to parse the event creation request
    const systemPrompt = `You are a calendar event parser. Extract event details from natural language and return a JSON object.

Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
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
      const model = 'gpt-4.1-mini';
      const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);
      const client = this.getProviderClient(model);

      const response = await generateText({
        model: client.languageModel(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        ...(supportsTemperature && { temperature: 0.1 }),
      });

      const content = response.text.trim();

      // Clean up the response - handle markdown code blocks
      let cleanedContent = content;
      const codeBlockMatch = cleanedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        cleanedContent = codeBlockMatch[1].trim();
      }

      const eventData = JSON.parse(cleanedContent) as CalendarEvent;

      // Validate required fields
      if (!eventData.summary) {
        throw new Error('Event title is required');
      }

      if (!eventData.start) {
        throw new Error('Event start time is required');
      }

      if (!eventData.end) {
        // If no end time, add 1 hour for timed events or next day for all-day events
        if (eventData.start.dateTime) {
          const startTime = new Date(eventData.start.dateTime);
          startTime.setHours(startTime.getHours() + 1);
          eventData.end = { dateTime: startTime.toISOString().replace('Z', '+08:00') };
        } else if (eventData.start.date) {
          const startDate = new Date(eventData.start.date);
          startDate.setDate(startDate.getDate() + 1);
          eventData.end = { date: startDate.toISOString().split('T')[0] };
        }
      }

      return eventData;

    } catch (error) {
      console.error('Error parsing event creation request:', error);
      throw new Error(`Failed to parse event details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processMessageWithTools(
    message: string,
    calendarTools: CalendarTools
  ): Promise<{
    response: string;
    toolCalls: Array<{ tool: string; result: unknown }>;
  }> {
    console.log('🔧 SIMPLE MODE: Processing message with tools:', message);

    // For now, let's implement a simpler approach that manually calls tools based on message analysis
    const toolCalls: Array<{ tool: string; result: unknown }> = [];
    let response = '';

    try {
      // Analyze the message to determine what tools to use
      const messageLower = message.toLowerCase();
      console.log('🔧 SIMPLE MODE: Message keywords analysis:', {
        hasSummarize: messageLower.includes('summarize'),
        hasEvents: messageLower.includes('events'),
        hasList: messageLower.includes('list'),
        hasShow: messageLower.includes('show'),
        hasPast: messageLower.includes('past'),
        hasReport: messageLower.includes('report'),
        hasActivities: messageLower.includes('activities'),
        hasCalendar: messageLower.includes('calendar')
      });

      if (messageLower.includes('summarize') || messageLower.includes('events') || messageLower.includes('list') || messageLower.includes('show') || messageLower.includes('past') || messageLower.includes('report') || messageLower.includes('activities')) {
        console.log('🔧 SIMPLE MODE: Detected event query - proceeding with calendar tools');
        // This is a query for events
        let toolResult;

        if (messageLower.includes('nespola')) {
          // Search for nespola events
          const timeRange = this.extractTimeRange(message);
          toolResult = await calendarTools.searchEvents('nespola', timeRange);
          toolCalls.push({ tool: 'searchEvents', result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as SimplifiedEvent[];
            if (events.length > 0) {
              // Use AI to generate a proper summary of Nespola events
              response = await this.generateEventSummary(events, message, 'Nespola-related');
            } else {
              response = "I didn't find any events related to Nespola in the specified time period.";
            }
          } else {
            response = `I tried to search for Nespola events but encountered an issue: ${toolResult.message || 'Unknown error'}`;
          }
        } else if (messageLower.includes('search') && (messageLower.includes('keyword') || messageLower.includes('term'))) {
          // Extract search keyword from message
          const searchKeyword = this.extractSearchKeyword(message);
          if (searchKeyword) {
            const timeRange = this.extractTimeRange(message);
            toolResult = await calendarTools.searchEvents(searchKeyword, timeRange);
            toolCalls.push({ tool: 'searchEvents', result: toolResult });

            if (toolResult.success && Array.isArray(toolResult.data)) {
              const events = toolResult.data as SimplifiedEvent[];
              if (events.length > 0) {
                response = await this.generateEventSummary(events, message, `events matching "${searchKeyword}"`);
              } else {
                response = `I didn't find any events matching "${searchKeyword}" in the specified time period.`;
              }
            } else {
              response = `I tried to search for events matching "${searchKeyword}" but encountered an issue: ${toolResult.message || 'Unknown error'}`;
            }
          } else {
            response = "I couldn't identify a search keyword in your request. Please specify what you'd like me to search for.";
          }
        } else {
          // General event listing/summarization
          console.log('🔧 SIMPLE MODE: Using general event listing/summarization path');
          const timeRange = this.extractTimeRange(message);
          console.log('🔧 SIMPLE MODE: Extracted time range:', timeRange);

          toolResult = await calendarTools.getEvents(timeRange);
          console.log('🔧 SIMPLE MODE: getEvents result:', {
            success: toolResult.success,
            dataLength: Array.isArray(toolResult.data) ? toolResult.data.length : 'not array',
            message: toolResult.message,
            error: toolResult.error
          });

          toolCalls.push({ tool: 'getEvents', result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as SimplifiedEvent[];
            if (events.length > 0) {
              console.log('🔧 SIMPLE MODE: Found', events.length, 'events, generating summary');
              console.log('🔧 SIMPLE MODE: Event data sample:', JSON.stringify(events.slice(0, 2), null, 2));
              // Use AI to generate a proper summary based on the request
              response = await this.generateEventSummary(events, message, 'your calendar events');
            } else {
              console.log('🔧 SIMPLE MODE: No events found in time period');
              response = "I didn't find any events in the specified time period.";
            }
          } else {
            console.log('🔧 SIMPLE MODE: getEvents failed:', toolResult.error || toolResult.message);
            response = `I tried to get your events but encountered an issue: ${toolResult.message || toolResult.error || 'Unknown error'}`;
          }
        }
      } else if (messageLower.includes('create') || messageLower.includes('schedule') || messageLower.includes('add') || messageLower.includes('book') || messageLower.includes('plan')) {
        // This is a request to create an event
        try {
          const eventData = await this.parseEventCreationRequest(message);
          const toolResult = await calendarTools.createEvent(eventData);
          toolCalls.push({ tool: 'createEvent', result: toolResult });

          if (toolResult.success) {
            response = `✅ Successfully created event: "${eventData.summary}"`;
            if (eventData.start?.dateTime) {
              const startDate = new Date(eventData.start.dateTime);
              response += `\n📅 Date: ${startDate.toLocaleDateString()}`;
              response += `\n🕒 Time: ${startDate.toLocaleTimeString()}`;
            } else if (eventData.start?.date) {
              response += `\n📅 Date: ${new Date(eventData.start.date).toLocaleDateString()} (All day)`;
            }
            if (eventData.location) {
              response += `\n📍 Location: ${eventData.location}`;
            }
          } else {
            response = `❌ Failed to create event: ${toolResult.error || 'Unknown error'}`;
          }
        } catch (parseError) {
          response = `❌ I couldn't understand the event details from your request. Please provide more specific information like the event title, date, and time. Error: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`;
        }
      } else {
        // General response
        console.log('🔧 SIMPLE MODE: No matching keywords - returning general response');
        response = "I understand your request, but I'm not sure how to help with that specific calendar operation yet. For calendar operations, try using words like 'summarize', 'list', 'show', 'events', or 'activities'.";
      }

      console.log('🔧 SIMPLE MODE: Final response:', response.substring(0, 200));
      return {
        response,
        toolCalls,
      };

    } catch (error) {
      console.error('🔧 SIMPLE MODE: Tool-based processing error:', error);
      return {
        response: "I encountered an error while processing your request. Please try again. Error details: " + (error instanceof Error ? error.message : 'Unknown error'),
        toolCalls,
      };
    }
  }

  // Helper method to extract search keyword from message
  private extractSearchKeyword(message: string): string | null {
    // Look for patterns like "search for X" or "find X" or "events about X"
    const patterns = [
      /search\s+(?:for\s+)?["\']?([^"'\s]+)["\']?/i,
      /find\s+(?:events?\s+)?(?:about\s+|with\s+)?["\']?([^"'\s]+)["\']?/i,
      /events?\s+(?:about\s+|with\s+|containing\s+)?["\']?([^"'\s]+)["\']?/i,
      /show\s+(?:me\s+)?(?:events?\s+)?(?:about\s+|with\s+)?["\']?([^"'\s]+)["\']?/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Helper method to generate AI-powered event summaries
  private async generateEventSummary(events: SimplifiedEvent[], originalMessage: string, contextDescription: string): Promise<string> {
    console.log('🔧 SIMPLE MODE: generateEventSummary called with', events.length, 'events');
    console.log('🔧 SIMPLE MODE: First event sample:', JSON.stringify(events[0], null, 2));

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
${events.map((event, index) => {
  // SimplifiedEvent has title, startDate, endDate directly
  const title = event.title || 'Untitled Event';
  const startDate = event.startDate;
  const endDate = event.endDate;

  console.log(`🔧 Event ${index + 1} mapping:`, {
    title,
    startDate,
    endDate,
    isAllDay: event.isAllDay
  });

  if (!startDate) {
    console.warn(`🔧 No startDate found for event ${index + 1}:`, event);
    return `${index + 1}. ${title} - Date unknown`;
  }

  const date = new Date(startDate);
  const time = !event.isAllDay && startDate.includes('T') ? ` at ${date.toLocaleTimeString()}` : '';
  const location = event.location ? ` (Location: ${event.location})` : '';
  const description = event.description ? `\n   Description: ${event.description}` : '';

  return `${index + 1}. ${title} - ${date.toLocaleDateString()}${time}${location}${description}`;
}).join('\n')}

Please create an appropriate response based on the user's request.`;

    console.log('🔧 SIMPLE MODE: Generated prompt for AI:', userPrompt.substring(0, 500) + '...');

    try {
      const model = 'gpt-4.1-mini';
      const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);
      const client = this.getProviderClient(model);

      const response = await generateText({
        model: client.languageModel(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        ...(supportsTemperature && { temperature: 0.3 }),
      });

      console.log('🔧 SIMPLE MODE: AI response for summary:', response.text?.substring(0, 200) + '...');
      return response.text || `I found ${events.length} ${contextDescription}.`;
    } catch (error) {
      console.error('Error generating event summary:', error);
      // Fallback to simple list format
      let fallback = `I found ${events.length} ${contextDescription}:\n\n`;
      events.forEach((event, index) => {
        const title = event.title || 'Untitled Event';
        const startDate = event.startDate || 'Unknown date';
        fallback += `${index + 1}. **${title}** - ${new Date(startDate).toLocaleDateString()}\n`;
        if (event.description) {
          fallback += `   ${event.description}\n`;
        }
        fallback += '\n';
      });
      return fallback;
    }
  }

  // Helper method to extract time range from message
  private extractTimeRange(message: string): { start?: string; end?: string } {
    const messageLower = message.toLowerCase();
    const now = new Date();

    console.log('🔧 SIMPLE MODE: Extracting time range from message:', messageLower);

    // Look for relative time expressions
    if (messageLower.includes('past week') || messageLower.includes('last week') || messageLower.includes('previous week')) {
      const startOfLastWeek = new Date(now);
      startOfLastWeek.setDate(now.getDate() - now.getDay() - 7); // Start of last week (Sunday)
      startOfLastWeek.setHours(0, 0, 0, 0);

      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // End of last week (Saturday)
      endOfLastWeek.setHours(23, 59, 59, 999);

      const timeRange = {
        start: startOfLastWeek.toISOString(),
        end: endOfLastWeek.toISOString()
      };

      console.log('🔧 SIMPLE MODE: Detected last week range:', {
        start: timeRange.start,
        end: timeRange.end,
        startFormatted: startOfLastWeek.toLocaleDateString(),
        endFormatted: endOfLastWeek.toLocaleDateString()
      });

      return timeRange;
    }

    if (messageLower.includes('past month') || messageLower.includes('last month') || messageLower.includes('previous month')) {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      return {
        start: startOfLastMonth.toISOString(),
        end: endOfLastMonth.toISOString()
      };
    }

    if (messageLower.includes('this week') || messageLower.includes('current week')) {
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - now.getDay()); // Start of this week (Sunday)
      startOfThisWeek.setHours(0, 0, 0, 0);

      const endOfThisWeek = new Date(startOfThisWeek);
      endOfThisWeek.setDate(startOfThisWeek.getDate() + 6); // End of this week (Saturday)
      endOfThisWeek.setHours(23, 59, 59, 999);

      return {
        start: startOfThisWeek.toISOString(),
        end: endOfThisWeek.toISOString()
      };
    }

    if (messageLower.includes('today')) {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      return {
        start: startOfToday.toISOString(),
        end: endOfToday.toISOString()
      };
    }

    if (messageLower.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      return {
        start: yesterday.toISOString(),
        end: endOfYesterday.toISOString()
      };
    }

    // Look for specific months and years
    if (messageLower.includes('march') && messageLower.includes('june') && messageLower.includes('2025')) {
      return {
        start: '2025-03-01T00:00:00+08:00',
        end: '2025-06-30T23:59:59+08:00'
      };
    }

    if (messageLower.includes('february') && messageLower.includes('april') && messageLower.includes('2025')) {
      return {
        start: '2025-02-01T00:00:00+08:00',
        end: '2025-04-30T23:59:59+08:00'
      };
    }

    // Look for single month references
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

    for (let i = 0; i < months.length; i++) {
      if (messageLower.includes(months[i])) {
        const year = messageLower.includes('2025') ? 2025 : now.getFullYear();
        const startOfMonth = new Date(year, i, 1);
        const endOfMonth = new Date(year, i + 1, 0, 23, 59, 59);

        return {
          start: startOfMonth.toISOString(),
          end: endOfMonth.toISOString()
        };
      }
    }

    // Default to current month if no specific range is mentioned
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    };
  }

  async translateToEnglish(text: string, model: ModelType = 'gpt-4.1-mini'): Promise<string> {
    // If text is already in English or looks like English, don't translate
    const englishPattern = /^[a-zA-Z0-9\s.,!?'"()/-]+$/;
    if (englishPattern.test(text) && text.split(' ').length > 1) {
      return text; // Skip translation for English text
    }

    const systemPrompt = `Translate the following text to English. If the text is already in English, return it EXACTLY as provided without any modifications or comments about the language.`;

    try {
      const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);
      const client = this.getProviderClient(model);

      const response = await generateText({
        model: client.languageModel(model),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        ...(supportsTemperature && { temperature: 0.1 }),
      });

      return response.text || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }

  async analyzeImageForEvents(imageBase64: string, prompt: string): Promise<ExtractedEvent[]> {
    try {
      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      const response = await generateText({
        model: this.openaiClient.languageModel('gpt-4.1-mini'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image',
                image: `data:image/jpeg;base64,${base64Data}`
              }
            ]
          }
        ],
        temperature: 0.3,
      });

      // Parse the JSON response
      const responseText = response.text.trim();

      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // If no array found, try to find any JSON object and wrap it
        jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonMatch[0] = `[${jsonMatch[0]}]`;
        }
      }

      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText);
        return [];
      }

      const eventsData = JSON.parse(jsonMatch[0]);
      return Array.isArray(eventsData) ? eventsData : [eventsData];

    } catch (error) {
      console.error('Vision analysis error:', error);
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method for processing messages with embedded images and files
  async processMessageWithEmbeddedFiles(
    message: string,
    processedFiles: Array<{
      fileName: string;
      fileSize: number;
      fileType: string;
      fileId?: string;
      imageData?: string;
      isImage?: boolean;
    }>,
    model: ModelType = 'gpt-4o'
  ): Promise<string> {
    try {
      if (!processedFiles || processedFiles.length === 0) {
        return "No files were provided for analysis.";
      }

      console.log(`🗃️ Processing message with ${processedFiles.length} files`);

      // Separate images from other files
      const images = processedFiles.filter(file => file.isImage && file.imageData);
      const documents = processedFiles.filter(file => !file.isImage && file.fileId);

      console.log(`📸 Found ${images.length} images and ${documents.length} documents`);

      let response = '';

      // Process images with vision API
      if (images.length > 0) {
        console.log('🔍 Processing images with vision API...');

        // Build vision message content
        const messageContent = [
          {
            type: 'text' as const,
            text: `Please analyze the uploaded image(s) and respond to: "${message}"\n\nProvide detailed information about what you see in the images.`
          },
          // Add each image to the message
          ...images.map(image => ({
            type: 'image' as const,
            image: `data:${image.fileType};base64,${image.imageData}`
          }))
        ];

        const visionResponse = await generateText({
          model: this.openaiClient.languageModel(model),
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],
          temperature: 0.3,
        });

        response += `## 📸 Image Analysis\n\n${visionResponse.text}\n\n`;
      }

      // Process documents with file search API
      if (documents.length > 0) {
        console.log('📄 Processing documents with file search API...');

        const fileIds = documents.map(doc => doc.fileId!);

        // Import FileSearchTool
        const { FileSearchTool } = await import('./file-search-tool');

        // Create and initialize the file search tool
        const fileSearchTool = new FileSearchTool(this.apiKey);

        try {
          const customInstructions = "You are a document analysis expert. Analyze the uploaded documents and provide relevant information to answer the user's question.";

          await fileSearchTool.initialize(fileIds, customInstructions, model);
          const searchResults = await fileSearchTool.searchFiles(message);

          if (searchResults && searchResults.length > 0) {
            response += "## 📄 Document Analysis\n\n";

            searchResults.forEach((result, index) => {
              response += `### ${result.filename ? `From ${result.filename}` : `Result ${index + 1}`}\n\n`;
              response += `${result.content}\n\n`;
            });
          }
        } finally {
          await fileSearchTool.cleanup();
        }
      }

      if (!response) {
        response = "I processed your files but couldn't find specific information related to your question. Please try asking more specific questions about the file contents.";
      }

      response += "\n---\n\n";
      response += "💡 **Additional help:**\n";
      response += "- Ask follow-up questions about the file contents\n";
      response += "- Request specific details or clarifications\n";
      response += "- Ask me to create calendar events based on the information\n";

      return response;

    } catch (error) {
      console.error('Embedded file processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return `❌ **File Analysis Error**\n\n` +
             `I encountered an issue while analyzing your files: ${errorMessage}\n\n` +
             `**Please try:**\n` +
             `- Uploading files in supported formats (PDF, images, TXT, etc.)\n` +
             `- Using smaller files or fewer files at once\n` +
             `- Asking more general questions about the content`;
    }
  }

  // Method for processing messages with uploaded files using OpenAI Assistant API
  async processMessageWithFiles(
    message: string,
    fileIds: string[],
    model: ModelType = 'gpt-4o'
  ): Promise<string> {
    try {
      if (!fileIds || fileIds.length === 0) {
        return "No files were provided for analysis.";
      }

      console.log(`🗃️ Processing message with ${fileIds.length} files:`, fileIds);

      // Import FileSearchTool
      const { FileSearchTool } = await import('./file-search-tool');

      // Create and initialize the file search tool
      const fileSearchTool = new FileSearchTool(this.apiKey);

      try {
        console.log('📋 AIService: About to initialize file search tool...');
        console.log('📋 AIService: File IDs to process:', fileIds);
        console.log('📋 AIService: Model to use:', model);

        // Provide more specific instructions based on the user's query
        const isContentDescriptionQuery = message.toLowerCase().includes('what') &&
          (message.toLowerCase().includes('see') || message.toLowerCase().includes('show') ||
           message.toLowerCase().includes('find') || message.toLowerCase().includes('content'));

        const customInstructions = isContentDescriptionQuery
          ? "You are a document analysis expert. When asked what you see in a file, provide a detailed, comprehensive description of ALL visible content including: " +
            "- All text, names, numbers, dates, and addresses " +
            "- Document type, format, and structure " +
            "- Any official markings, stamps, logos, or signatures " +
            "- Tables, forms, or organized data " +
            "- Images or visual elements " +
            "- Any other notable details or information visible in the document. " +
            "Be thorough and specific - list actual content rather than generic descriptions."
          : "You are a helpful assistant that analyzes uploaded files and provides context-aware responses. " +
            "Search through the file contents to find relevant information that helps answer the user's question.";

        await fileSearchTool.initialize(fileIds, customInstructions, model);
        console.log('✅ AIService: File search tool initialized successfully');

        console.log('🔍 AIService: File search tool initialized, starting search...');
        const searchResults = await fileSearchTool.searchFiles(message);
        console.log('🔍 AIService: Search completed, processing results...');

        console.log('📊 Search results received:', {
          resultsCount: searchResults?.length || 0,
          hasResults: !!(searchResults && searchResults.length > 0),
          firstResultPreview: searchResults?.[0]?.content?.substring(0, 200) || 'No content'
        });

        // CRITICAL: Check if file search actually worked
        if (!searchResults || searchResults.length === 0) {
          console.error('❌ CRITICAL ERROR: File search returned no results - this indicates a failure in processing');
          throw new Error('File search failed to process the uploaded files. The file may not be readable or there was an API error.');
        }

        if (searchResults && searchResults.length > 0) {
          const fileCount = fileIds.length;
          const fileWord = fileCount === 1 ? 'file' : 'files';

          // Format the response with file search results
          let response = `I've analyzed your uploaded ${fileWord} and found relevant information for your question: "${message}"\n\n`;

          response += "## 📄 Analysis Results\n\n";

          searchResults.forEach((result, index) => {
            response += `### ${result.filename ? `From ${result.filename}` : `Result ${index + 1}`}\n\n`;
            response += `${result.content}\n\n`;

            if (result.relevance && result.relevance < 1.0) {
              response += `*Relevance: ${Math.round(result.relevance * 100)}%*\n\n`;
            }
          });

          response += "---\n\n";
          response += "💡 **How to use this information:**\n";
          response += "- You can ask follow-up questions about the file contents\n";
          response += "- Request specific details or clarifications\n";
          response += "- Ask me to create calendar events based on the file information\n";
          response += "- Upload additional files for comparison or context\n\n";

          response += `✅ Successfully analyzed ${fileCount} ${fileWord} using OpenAI Assistant API with file search.`;

          return response;
        } else {
          const fileCount = fileIds.length;
          const fileWord = fileCount === 1 ? 'file' : 'files';

          return `I've processed your uploaded ${fileWord}, but I couldn't find specific information related to your question: "${message}"\n\n` +
                 "This could mean:\n" +
                 "- The question might not be directly addressed in the uploaded files\n" +
                 "- The files might need more processing time\n" +
                 "- Try rephrasing your question or asking about different aspects\n\n" +
                 "You can:\n" +
                 "- Ask more general questions about the file contents\n" +
                 "- Upload additional relevant files\n" +
                 "- Use other calendar assistant features while I continue processing\n\n" +
                 `📁 Files processed: ${fileCount} ${fileWord}`;
        }

      } finally {
        // Clean up resources
        console.log('🧹 Cleaning up file search resources...');
        await fileSearchTool.cleanup();
      }

    } catch (error) {
      console.error('File processing error:', error);

      // Provide a helpful error message to the user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return `❌ **File Analysis Error**\n\n` +
             `I encountered an issue while analyzing your uploaded files: ${errorMessage}\n\n` +
             `**Possible solutions:**\n` +
             `- Check if the files are in a supported format (PDF, TXT, DOCX, etc.)\n` +
             `- Try uploading smaller files or fewer files at once\n` +
             `- Ensure files contain readable text content\n` +
             `- Try again in a few moments\n\n` +
             `**Alternative:** You can still use the regular chat features for calendar management while I work on resolving this issue.`;
    }
  }
}
