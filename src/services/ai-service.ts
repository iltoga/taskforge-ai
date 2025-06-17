import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CalendarAction, CalendarEvent } from '../types/calendar';

export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'o3' | 'o3-mini' | 'o4-mini' | 'o4-mini-high' | 'deepseek/deepseek-chat-v3-0324:free';

export type ProviderType = 'openai' | 'openrouter';

export interface AIProviderConfig {
  provider: ProviderType;
  apiKey: string;
  baseURL?: string;
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
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      console.error('Error loading system prompt template:', error);
      // Fallback to a basic prompt if file loading fails
      return 'You are CalendarGPT, a digital assistant for managing Google Calendar events. Always respond with valid JSON only.';
    }
  }

  async processMessage(
    message: string,
    existingEvents?: CalendarEvent[],
    model: ModelType = 'gpt-4o-mini'
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
      // Use temperature only for models that support it
      const supportsTemperature = !['o4-mini', 'o4-mini-high'].includes(model);
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

      const action = JSON.parse(content) as CalendarAction;

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

  async generateWeeklyReport(events: CalendarEvent[], company: string, startDate: string, endDate: string, model: ModelType = 'gpt-4o-mini'): Promise<string> {
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
      // Use temperature only for models that support it
      const supportsTemperature = !['o4-mini', 'o4-mini-high'].includes(model);
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

  async translateToEnglish(text: string, model: ModelType = 'gpt-4o-mini'): Promise<string> {
    const systemPrompt = `
You are a professional translator. Translate the given text to English if it's not already in English.
If the text is already in English, return it unchanged.
Use professional tone and concise language suitable for calendar events.
`;

    try {
      // Use temperature only for models that support it
      const supportsTemperature = !['o4-mini', 'o4-mini-high'].includes(model);
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
      throw error;
    }
  }
}
