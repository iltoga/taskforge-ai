import OpenAI from 'openai';
import { CalendarAction, CalendarEvent } from '../types/calendar';

export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';

export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
    });
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

  async processMessage(
    message: string,
    existingEvents?: CalendarEvent[],
    model: ModelType = 'gpt-4o-mini'
  ): Promise<CalendarAction> {
    const systemPrompt = `
You are CalendarGPT, a highly efficient and user-friendly digital assistant for managing Google Calendar events.
You communicate in a friendly yet professional tone, striking a balance between approachability and formality.

IMPORTANT RULES:
1. All events must be written in English with professional tone and concise language
2. If user input is in a different language, translate it to English before processing
3. Use timezone Asia/Makassar (+08:00) for all dateTime fields
4. Current date is June 15, 2025

RESPONSE FORMAT:
Always respond with a valid JSON object containing:
- type: "create" | "update" | "delete" | "list"
- event?: CalendarEvent object (for create/update operations)
- eventId?: string (for update/delete operations)
- timeRange?: {start: string, end: string} (for list operations)

SPECIAL EVENT TYPES:

**Daily Work Report:**
When asked to create a daily work report:
- Title: "daily report - [Company name]"
- Description: Bullet list of activities (• format)
- All-day event for current day (use date format, not dateTime)

When asked to update a daily work report:
- Find existing "daily report" event for the day
- Add new activities to existing bullet list
- Never create duplicate daily reports for the same day

**All-day events:**
Use date format (not dateTime) for start/end:
{
  "start": {"date": "2024-06-15"},
  "end": {"date": "2024-06-16"}
}

**Reminders:**
For events needing reminders:
{
  "reminders": {
    "useDefault": false,
    "overrides": [
      {"method": "email", "minutes": 30},
      {"method": "popup", "minutes": 10}
    ]
  }
}

Current timezone: Asia/Makassar (+08:00)
`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    if (existingEvents && existingEvents.length > 0) {
      // Limit events to prevent token overflow
      const limitedEvents = this.limitEventsContext(existingEvents);
      messages.push({
        role: 'system',
        content: `Recent events for context (${limitedEvents.length} most recent): ${JSON.stringify(limitedEvents, null, 2)}`
      });
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: model, // Use the selected model
        messages,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const action = JSON.parse(content) as CalendarAction;
      return action;
    } catch (error) {
      if (error instanceof SyntaxError) {
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
      const response = await this.openai.chat.completions.create({
        model: model, // Use the selected model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || '';
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
      const response = await this.openai.chat.completions.create({
        model: model, // Use the selected model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
      });

      return response.choices[0]?.message?.content || text;
    } catch (error) {
      throw error;
    }
  }
}
