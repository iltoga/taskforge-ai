import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ModelType } from '../appconfig/models';
import { CalendarTools } from '../tools/calendar-tools';
import { CalendarAction, CalendarEvent } from '../types/calendar';

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
      console.error('Error loading system prompt template:', error);
      // Fallback to a basic prompt if file loading fails
      const today = new Date();
      const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return `Today is ${formattedDate}.\n\nYou are CalendarGPT, a digital assistant for managing Google Calendar events. Always respond with valid JSON only.`;
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
      return `Today is ${formattedDate}.\n\nYou are CalendarGPT, a digital assistant for managing Google Calendar events with access to tools.`;
    }
  }

  async processMessage(
    message: string,
    existingEvents?: CalendarEvent[],
    model: ModelType = 'gpt-4.1-mini-2025-04-14'
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

  async generateWeeklyReport(events: CalendarEvent[], company: string, startDate: string, endDate: string, model: ModelType = 'gpt-4.1-mini-2025-04-14'): Promise<string> {
    const systemPrompt = `
You are tasked with generating a detailed weekly work report for Stefano.
Format the output as follows:

Stefano's Weekly WorkLog for [Company Name] - [start date / end date]

For each day with events, list:
**[Day, Date]:**
• [Activity 1]
• [Activity 2]
...

At the end, add:
**Summary:**
[Brief summary emphasizing main focus and achievements]

Use professional, concise language and improve grammar/formatting of the original activities.
`;

    const userPrompt = `
Generate a weekly work report for ${company} from ${startDate} to ${endDate}.

Events data:
${events.map(event => `Date: ${event.start?.date || event.start?.dateTime}, Activities: ${event.description}`).join('\n')}
`;

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
    orchestratorModel: ModelType = 'gpt-4.1-mini-2025-04-14',
    developmentMode: boolean = false
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

      const result = await orchestrator.orchestrate(
        message,
        chatHistory,
        toolRegistry as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        orchestratorModel,
        {
          maxSteps: 10,
          maxToolCalls: 5,
          developmentMode
        }
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
    orchestratorModel: ModelType = 'gpt-4.1-mini-2025-04-14',
    developmentMode: boolean = false,
    progressCallback: (data: { type: string; message?: string; [key: string]: unknown }) => void
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
        }
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

  async processMessageWithTools(
    message: string,
    calendarTools: CalendarTools
  ): Promise<{
    response: string;
    toolCalls: Array<{ tool: string; result: unknown }>;
  }> {
    // For now, let's implement a simpler approach that manually calls tools based on message analysis
    const toolCalls: Array<{ tool: string; result: unknown }> = [];
    let response = '';

    try {
      // Analyze the message to determine what tools to use
      const messageLower = message.toLowerCase();

      if (messageLower.includes('summarize') || messageLower.includes('events') || messageLower.includes('list')) {
        // This is a query for events
        let toolResult;

        if (messageLower.includes('nespola')) {
          // Search for nespola events
          const timeRange = this.extractTimeRange(message);
          toolResult = await calendarTools.searchEvents('nespola', timeRange);
          toolCalls.push({ tool: 'searchEvents', result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as CalendarEvent[];
            if (events.length > 0) {
              response = `I found ${events.length} events related to Nespola:\n\n`;
              events.forEach((event, index) => {
                const date = event.start?.dateTime || event.start?.date || 'Unknown date';
                response += `${index + 1}. **${event.summary}** - ${new Date(date).toLocaleDateString()}\n`;
                if (event.description) {
                  response += `   ${event.description}\n`;
                }
                response += '\n';
              });
            } else {
              response = "I didn't find any events related to Nespola in the specified time period.";
            }
          } else {
            response = `I tried to search for Nespola events but encountered an issue: ${toolResult.message || 'Unknown error'}`;
          }
        } else {
          // General event listing
          const timeRange = this.extractTimeRange(message);
          toolResult = await calendarTools.getEvents(timeRange);
          toolCalls.push({ tool: 'getEvents', result: toolResult });

          if (toolResult.success && Array.isArray(toolResult.data)) {
            const events = toolResult.data as CalendarEvent[];
            response = `I found ${events.length} events in the specified time period.`;
          } else {
            response = `I tried to get your events but encountered an issue: ${toolResult.message || 'Unknown error'}`;
          }
        }
      } else if (messageLower.includes('create') || messageLower.includes('schedule') || messageLower.includes('add')) {
        // This is a request to create an event
        response = "I understand you want to create an event. The tool-based event creation is not yet implemented in this version.";
      } else {
        // General response
        response = "I understand your request, but I'm not sure how to help with that specific calendar operation yet.";
      }

      return {
        response,
        toolCalls,
      };

    } catch (error) {
      console.error('Tool-based processing error:', error);
      return {
        response: "I encountered an error while processing your request. Please try again.",
        toolCalls,
      };
    }
  }

  // Helper method to extract time range from message
  private extractTimeRange(message: string): { start?: string; end?: string } {
    const messageLower = message.toLowerCase();

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

    // Default to current month if no specific range is mentioned
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    };
  }

  async translateToEnglish(text: string, model: ModelType = 'gpt-4.1-mini-2025-04-14'): Promise<string> {
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
        model: this.openaiClient.languageModel('gpt-4.1-mini-2025-04-14'),
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
}
