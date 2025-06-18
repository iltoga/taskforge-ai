import { z } from 'zod';
import { CalendarEvent } from '../types/calendar';
import { CalendarTools } from './calendar-tools';
import { EmailTools } from './email-tools';
import { FileTools } from './file-tools';
import { WebTools } from './web-tools';

// Base interfaces for tools
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<unknown>;
  category: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}

export interface ToolExecution {
  tool: string;
  parameters: Record<string, unknown>;
  result: ToolResult;
  startTime: number;
  endTime: number;
  duration: number;
}

// Tool registry interface
export interface ToolRegistry {
  registerTool(definition: ToolDefinition, executor: ToolExecutor): void;
  getAvailableTools(): ToolDefinition[];
  getToolDefinition(name: string): ToolDefinition | undefined;
  executeTool(name: string, parameters: Record<string, unknown>): Promise<ToolResult>;
  getToolsByCategory(category: string): ToolDefinition[];
  getAvailableCategories(): string[];
}

export type ToolExecutor = (parameters: Record<string, unknown>) => Promise<ToolResult>;

// Implementation of the tool registry
export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, { definition: ToolDefinition; executor: ToolExecutor }>();

  registerTool(definition: ToolDefinition, executor: ToolExecutor): void {
    this.tools.set(definition.name, { definition, executor });
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  getToolDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.definition.category === category)
      .map(tool => tool.definition);
  }

  getAvailableCategories(): string[] {
    const categories = new Set<string>();
    this.tools.forEach(tool => categories.add(tool.definition.category));
    return Array.from(categories).sort();
  }

  async executeTool(name: string, parameters: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        message: `Unknown tool: ${name}`
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.definition.parameters.parse(parameters);

      // Execute the tool
      return await tool.executor(validatedParams as Record<string, unknown>);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Failed to execute tool: ${name}`
      };
    }
  }
}

// Factory function to create and configure a tool registry
export function createToolRegistry(
  calendarTools: CalendarTools,
  emailTools?: EmailTools,
  fileTools?: FileTools,
  webTools?: WebTools
): ToolRegistry {
  const registry = new DefaultToolRegistry();

  // Register calendar tools
  registry.registerTool(
    {
      name: 'getEvents',
      description: 'Get calendar events within a time range with optional filters. Returns simplified event objects optimized for AI processing (only essential fields: id, title, description, startDate, endDate, isAllDay, location, attendeeCount, status).',
      parameters: z.object({
        timeRange: z.object({
          start: z.string().optional().describe('ISO date string for start time (e.g., "2025-03-01" or "2025-03-01T00:00:00+08:00")'),
          end: z.string().optional().describe('ISO date string for end time (e.g., "2025-06-30" or "2025-06-30T23:59:59+08:00")'),
        }).optional().describe('Time range to search for events'),
        filters: z.object({
          query: z.string().optional().describe('Search query to filter events'),
          maxResults: z.number().optional().describe('Maximum number of results to return (default: 100)'),
          showDeleted: z.boolean().optional().describe('Whether to include deleted events'),
          orderBy: z.enum(['startTime', 'updated']).optional().describe('How to order results'),
        }).optional().describe('Additional filters for events'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { timeRange?: { start?: string; end?: string }; filters?: { query?: string; maxResults?: number; showDeleted?: boolean; orderBy?: 'startTime' | 'updated' } };
      return await calendarTools.getEvents(p.timeRange, p.filters);
    }
  );

  registry.registerTool(
    {
      name: 'searchEvents',
      description: 'Search calendar events by query string. Returns simplified event objects optimized for AI processing. Use this to find events containing specific keywords, company names, or project names in title, description, or location.',
      parameters: z.object({
        query: z.string().describe('Search query to find events (e.g., company name like "Nespola", project name, keyword)'),
        timeRange: z.object({
          start: z.string().optional().describe('ISO date string for start time (e.g., "2025-03-01" or "2025-03-01T00:00:00+08:00")'),
          end: z.string().optional().describe('ISO date string for end time (e.g., "2025-06-30" or "2025-06-30T23:59:59+08:00")'),
        }).optional().describe('Time range to search within'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { query: string; timeRange?: { start?: string; end?: string } };
      return await calendarTools.searchEvents(p.query, p.timeRange);
    }
  );

  registry.registerTool(
    {
      name: 'createEvent',
      description: 'Create a new calendar event. Use this when the user wants to schedule, add, or create an event.',
      parameters: z.object({
        eventData: z.object({
          summary: z.string().describe('Event title/summary'),
          description: z.string().optional().describe('Event description'),
          start: z.object({
            dateTime: z.string().optional().describe('Start date-time (ISO format)'),
            date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).describe('Event start time'),
          end: z.object({
            dateTime: z.string().optional().describe('End date-time (ISO format)'),
            date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).describe('Event end time'),
          location: z.string().optional().describe('Event location'),
          attendees: z.array(z.object({
            email: z.string().describe('Attendee email'),
            displayName: z.string().optional().describe('Attendee display name'),
          })).optional().describe('Event attendees'),
        }).describe('Event data to create'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventData: CalendarEvent };
      return await calendarTools.createEvent(p.eventData);
    }
  );

  registry.registerTool(
    {
      name: 'updateEvent',
      description: 'Update an existing calendar event. Use this when the user wants to modify or change an existing event.',
      parameters: z.object({
        eventId: z.string().describe('ID of the event to update'),
        changes: z.object({
          summary: z.string().optional().describe('Event title/summary'),
          description: z.string().optional().describe('Event description'),
          start: z.object({
            dateTime: z.string().optional().describe('Start date-time (ISO format)'),
            date: z.string().optional().describe('Start date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).optional().describe('Event start time'),
          end: z.object({
            dateTime: z.string().optional().describe('End date-time (ISO format)'),
            date: z.string().optional().describe('End date for all-day events (YYYY-MM-DD)'),
            timeZone: z.string().optional().describe('Time zone'),
          }).optional().describe('Event end time'),
          location: z.string().optional().describe('Event location'),
          attendees: z.array(z.object({
            email: z.string().describe('Attendee email'),
            displayName: z.string().optional().describe('Attendee display name'),
          })).optional().describe('Event attendees'),
        }).describe('Changes to apply to the event'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventId: string; changes: Partial<CalendarEvent> };
      return await calendarTools.updateEvent(p.eventId, p.changes);
    }
  );

  registry.registerTool(
    {
      name: 'deleteEvent',
      description: 'Delete a calendar event. Use this when the user wants to remove or cancel an event.',
      parameters: z.object({
        eventId: z.string().describe('ID of the event to delete'),
      }),
      category: 'calendar'
    },
    async (params: Record<string, unknown>) => {
      const p = params as { eventId: string };
      return await calendarTools.deleteEvent(p.eventId);
    }
  );

  // Register email tools if provided
  if (emailTools) {
    registry.registerTool(
      {
        name: 'sendEmail',
        description: 'Send an email message to recipients. Use this to compose and send emails.',
        parameters: z.object({
          emailData: z.object({
            to: z.array(z.string()).describe('Recipient email addresses'),
            cc: z.array(z.string()).optional().describe('CC email addresses'),
            bcc: z.array(z.string()).optional().describe('BCC email addresses'),
            subject: z.string().describe('Email subject'),
            body: z.string().describe('Email body content'),
            priority: z.enum(['low', 'normal', 'high']).optional().describe('Email priority'),
            isHtml: z.boolean().optional().describe('Whether the body contains HTML'),
          }).describe('Email message data'),
        }),
        category: 'email'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { emailData: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; priority?: 'low' | 'normal' | 'high'; isHtml?: boolean } };
        return await emailTools.sendEmail(p.emailData);
      }
    );

    registry.registerTool(
      {
        name: 'searchEmails',
        description: 'Search for emails with various filters. Use this to find specific emails.',
        parameters: z.object({
          filters: z.object({
            from: z.string().optional().describe('Filter by sender email'),
            to: z.string().optional().describe('Filter by recipient email'),
            subject: z.string().optional().describe('Filter by subject keywords'),
            body: z.string().optional().describe('Filter by body content'),
            hasAttachment: z.boolean().optional().describe('Filter by attachment presence'),
            isRead: z.boolean().optional().describe('Filter by read/unread status'),
            dateRange: z.object({
              start: z.string().optional().describe('Start date for search range'),
              end: z.string().optional().describe('End date for search range'),
            }).optional().describe('Date range filter'),
            maxResults: z.number().optional().describe('Maximum number of results'),
          }).describe('Search filters for emails'),
        }),
        category: 'email'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { filters: { from?: string; to?: string; subject?: string; body?: string; hasAttachment?: boolean; isRead?: boolean; dateRange?: { start?: string; end?: string }; maxResults?: number } };
        return await emailTools.searchEmails(p.filters);
      }
    );

    registry.registerTool(
      {
        name: 'replyToEmail',
        description: 'Reply to an existing email. Use this to respond to received emails.',
        parameters: z.object({
          emailId: z.string().describe('ID of the email to reply to'),
          replyData: z.object({
            body: z.string().describe('Reply message body'),
            replyAll: z.boolean().optional().describe('Whether to reply to all recipients'),
          }).describe('Reply content and options'),
        }),
        category: 'email'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { emailId: string; replyData: { body: string; replyAll?: boolean } };
        return await emailTools.replyToEmail(p.emailId, p.replyData);
      }
    );
  }

  // Register file tools if provided
  if (fileTools) {
    registry.registerTool(
      {
        name: 'listFiles',
        description: 'List files and directories in a given path. Use this to explore directory contents.',
        parameters: z.object({
          directoryPath: z.string().describe('Path to the directory to list'),
          recursive: z.boolean().optional().describe('Whether to list recursively'),
        }),
        category: 'file'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { directoryPath: string; recursive?: boolean };
        return await fileTools.listFiles(p.directoryPath, p.recursive);
      }
    );

    registry.registerTool(
      {
        name: 'readFile',
        description: 'Read the content of a file. Use this to view file contents.',
        parameters: z.object({
          filePath: z.string().describe('Path to the file to read'),
        }),
        category: 'file'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { filePath: string };
        return await fileTools.readFile(p.filePath);
      }
    );

    registry.registerTool(
      {
        name: 'writeFile',
        description: 'Write content to a file. Use this to create or update files.',
        parameters: z.object({
          filePath: z.string().describe('Path where to write the file'),
          content: z.string().describe('Content to write to the file'),
          overwrite: z.boolean().optional().describe('Whether to overwrite if file exists'),
        }),
        category: 'file'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { filePath: string; content: string; overwrite?: boolean };
        return await fileTools.writeFile(p.filePath, p.content, p.overwrite);
      }
    );

    registry.registerTool(
      {
        name: 'searchFiles',
        description: 'Search for files with various criteria. Use this to find specific files.',
        parameters: z.object({
          searchPath: z.string().describe('Path to search in'),
          filters: z.object({
            name: z.string().optional().describe('Filter by file name pattern'),
            extension: z.string().optional().describe('Filter by file extension'),
            type: z.enum(['file', 'directory']).optional().describe('Filter by file type'),
            sizeMin: z.number().optional().describe('Minimum file size in bytes'),
            sizeMax: z.number().optional().describe('Maximum file size in bytes'),
            maxResults: z.number().optional().describe('Maximum number of results'),
          }).describe('Search criteria'),
        }),
        category: 'file'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { searchPath: string; filters: { name?: string; extension?: string; type?: 'file' | 'directory'; sizeMin?: number; sizeMax?: number; maxResults?: number } };
        return await fileTools.searchFiles(p.searchPath, p.filters);
      }
    );
  }

  // Register web tools if provided
  if (webTools) {
    registry.registerTool(
      {
        name: 'searchWeb',
        description: 'Search the web for information using search engines. Use this to find information online.',
        parameters: z.object({
          query: z.string().describe('Search query'),
          filters: z.object({
            site: z.string().optional().describe('Limit search to specific site'),
            maxResults: z.number().optional().describe('Maximum number of results'),
          }).optional().describe('Search filters'),
        }),
        category: 'web'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { query: string; filters?: { site?: string; maxResults?: number } };
        return await webTools.searchWeb(p.query, p.filters);
      }
    );

    registry.registerTool(
      {
        name: 'getWebPageContent',
        description: 'Get the content of a specific web page. Use this to read web page content.',
        parameters: z.object({
          url: z.string().describe('URL of the web page to fetch'),
        }),
        category: 'web'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { url: string };
        return await webTools.getWebPageContent(p.url);
      }
    );

    registry.registerTool(
      {
        name: 'summarizeWebPage',
        description: 'Get a summary of a web page content. Use this to quickly understand web page contents.',
        parameters: z.object({
          url: z.string().describe('URL of the web page to summarize'),
          maxLength: z.number().optional().describe('Maximum length of the summary'),
        }),
        category: 'web'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { url: string; maxLength?: number };
        return await webTools.summarizeWebPage(p.url, p.maxLength);
      }
    );

    registry.registerTool(
      {
        name: 'checkWebsite',
        description: 'Check if a website is accessible and get status information. Use this to verify website availability.',
        parameters: z.object({
          url: z.string().describe('URL of the website to check'),
        }),
        category: 'web'
      },
      async (params: Record<string, unknown>) => {
        const p = params as { url: string };
        return await webTools.checkWebsite(p.url);
      }
    );
  }

  return registry;
}

// Helper function to convert tool definitions to AI function call format
export function toolDefinitionsToAIFunctions(tools: ToolDefinition[]) {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: zodSchemaToJsonSchema(tool.parameters),
      required: getRequiredProperties(tool.parameters)
    }
  }));
}

// Helper function to convert Zod schema to JSON schema (simplified)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodSchemaToJsonSchema(schema: z.ZodSchema<any>): any {
  // This is a simplified conversion - in a production app you might want to use
  // a library like zod-to-json-schema for more complete conversion
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: any = {};

    for (const [key, value] of Object.entries(shape)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties[key] = zodSchemaToJsonSchema(value as z.ZodSchema<any>);
    }

    return {
      type: 'object',
      properties
    };
  } else if (schema instanceof z.ZodString) {
    return { type: 'string', description: schema.description };
  } else if (schema instanceof z.ZodNumber) {
    return { type: 'number', description: schema.description };
  } else if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', description: schema.description };
  } else if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodSchemaToJsonSchema(schema.element),
      description: schema.description
    };
  } else if (schema instanceof z.ZodOptional) {
    return zodSchemaToJsonSchema(schema.unwrap());
  } else if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
      description: schema.description
    };
  }

  return { type: 'string' }; // fallback
}

// Helper function to get required properties from Zod schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRequiredProperties(schema: z.ZodSchema<any>): string[] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return required;
  }

  return [];
}
