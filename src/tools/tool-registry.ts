import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { CalendarEvent } from '../types/calendar';
import { CalendarTools } from './calendar-tools';
import { EmailTools } from './email-tools';
import { FileTools } from './file-tools';
import { PassportTools } from './passport-tools';
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

// Load tool configuration from settings
export function loadToolConfiguration(): { [key: string]: boolean } {
  let enabled: { [key: string]: boolean } = { calendar: true, email: false, file: false, web: false, passport: false };
  try {
    const configPath = path.resolve(process.cwd(), 'settings/enabled-tools.json');
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      enabled = JSON.parse(configContent);
    }
  } catch (err) {
    // Fallback to all enabled if config missing or invalid
    console.warn('Could not load enabled-tools.json, defaulting to all enabled:', err);
  }
  return enabled;
}

// Factory function to create and configure a tool registry
export function createToolRegistry(
  calendarTools: CalendarTools,
  emailTools?: EmailTools,
  fileTools?: FileTools,
  webTools?: WebTools,
  passportTools?: PassportTools,
  configOverride?: { [key: string]: boolean }
): ToolRegistry {
  const registry = new DefaultToolRegistry();

  // Load enabled tool categories from settings/enabled-tools.json or use override
  const enabled = configOverride || loadToolConfiguration();

  // Register calendar tools if enabled
  if (enabled.calendar !== false) {
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
  }

  // Register email tools if provided and enabled
  if (emailTools && enabled.email !== false) {
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

  // Register file tools if provided and enabled
  if (fileTools && enabled.file !== false) {
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

  // Register web tools if provided and enabled
  if (webTools && enabled.web !== false) {
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

  // Register passport tools if provided and enabled
  if (passportTools && enabled.passport !== false) {
    registry.registerTool(
      {
        name: 'setupPassportSchema',
        description: 'Initialize the passport database schema. Call this first before using other passport operations.',
        parameters: z.object({}),
        category: 'passport'
      },
      async () => {
        return await passportTools.setupSchema();
      }
    );

    registry.registerTool(
      {
        name: 'createPassport',
        description: 'Create a new passport record in the database. Use this to add passport information.',
        parameters: z.object({
          passport_number: z.string().describe('Passport number'),
          surname: z.string().describe('Surname/family name'),
          given_names: z.string().describe('Given names/first names'),
          nationality: z.string().describe('Nationality'),
          date_of_birth: z.string().describe('Date of birth in ISO format (YYYY-MM-DD)'),
          sex: z.string().describe('Sex (M/F)'),
          place_of_birth: z.string().describe('Place of birth'),
          date_of_issue: z.string().describe('Date of issue in ISO format (YYYY-MM-DD)'),
          date_of_expiry: z.string().describe('Date of expiry in ISO format (YYYY-MM-DD)'),
          issuing_authority: z.string().describe('Issuing authority'),
          holder_signature_present: z.boolean().describe('Whether holder signature is present'),
          residence: z.string().optional().describe('Residence'),
          height_cm: z.number().optional().describe('Height in centimeters'),
          eye_color: z.string().optional().describe('Eye color'),
          type: z.string().describe('Passport type'),
        }),
        category: 'passport'
      },
      async (params: Record<string, unknown>) => {
        const p = params as {
          passport_number: string;
          surname: string;
          given_names: string;
          nationality: string;
          date_of_birth: string;
          sex: string;
          place_of_birth: string;
          date_of_issue: string;
          date_of_expiry: string;
          issuing_authority: string;
          holder_signature_present: boolean;
          residence?: string;
          height_cm?: number;
          eye_color?: string;
          type: string;
        };

        // Convert date strings to Date objects
        const passportData = {
          ...p,
          date_of_birth: new Date(p.date_of_birth),
          date_of_issue: new Date(p.date_of_issue),
          date_of_expiry: new Date(p.date_of_expiry),
        };

        return await passportTools.createPassport(passportData);
      }
    );

    registry.registerTool(
      {
        name: 'getPassports',
        description: 'Retrieve passport records from the database with optional filters. Use this to search for existing passports.',
        parameters: z.object({
          passport_number: z.string().optional().describe('Filter by passport number'),
          surname: z.string().optional().describe('Filter by surname'),
          given_names: z.string().optional().describe('Filter by given names'),
          nationality: z.string().optional().describe('Filter by nationality'),
          date_of_birth: z.string().optional().describe('Filter by date of birth (ISO format)'),
          sex: z.string().optional().describe('Filter by sex'),
          place_of_birth: z.string().optional().describe('Filter by place of birth'),
          date_of_issue: z.string().optional().describe('Filter by date of issue (ISO format)'),
          date_of_expiry: z.string().optional().describe('Filter by date of expiry (ISO format)'),
          issuing_authority: z.string().optional().describe('Filter by issuing authority'),
          holder_signature_present: z.boolean().optional().describe('Filter by signature presence'),
          residence: z.string().optional().describe('Filter by residence'),
          height_cm: z.number().optional().describe('Filter by height in cm'),
          eye_color: z.string().optional().describe('Filter by eye color'),
          type: z.string().optional().describe('Filter by passport type'),
        }),
        category: 'passport'
      },
      async (params: Record<string, unknown>) => {
        const p = params as Record<string, unknown>;

        // Convert date strings to Date objects if provided
        const filters: Record<string, unknown> = { ...p };
        if (filters.date_of_birth && typeof filters.date_of_birth === 'string') {
          filters.date_of_birth = new Date(filters.date_of_birth);
        }
        if (filters.date_of_issue && typeof filters.date_of_issue === 'string') {
          filters.date_of_issue = new Date(filters.date_of_issue);
        }
        if (filters.date_of_expiry && typeof filters.date_of_expiry === 'string') {
          filters.date_of_expiry = new Date(filters.date_of_expiry);
        }

        return await passportTools.getPassports(filters);
      }
    );

    registry.registerTool(
      {
        name: 'updatePassport',
        description: 'Update an existing passport record by ID. Use this to modify passport information.',
        parameters: z.object({
          id: z.number().describe('ID of the passport record to update'),
          passport_number: z.string().optional().describe('Passport number'),
          surname: z.string().optional().describe('Surname/family name'),
          given_names: z.string().optional().describe('Given names/first names'),
          nationality: z.string().optional().describe('Nationality'),
          date_of_birth: z.string().optional().describe('Date of birth in ISO format (YYYY-MM-DD)'),
          sex: z.string().optional().describe('Sex (M/F)'),
          place_of_birth: z.string().optional().describe('Place of birth'),
          date_of_issue: z.string().optional().describe('Date of issue in ISO format (YYYY-MM-DD)'),
          date_of_expiry: z.string().optional().describe('Date of expiry in ISO format (YYYY-MM-DD)'),
          issuing_authority: z.string().optional().describe('Issuing authority'),
          holder_signature_present: z.boolean().optional().describe('Whether holder signature is present'),
          residence: z.string().optional().describe('Residence'),
          height_cm: z.number().optional().describe('Height in centimeters'),
          eye_color: z.string().optional().describe('Eye color'),
          type: z.string().optional().describe('Passport type'),
        }),
        category: 'passport'
      },
      async (params: Record<string, unknown>) => {
        const { id, ...updateData } = params as { id: number } & Record<string, unknown>;

        // Convert date strings to Date objects if provided
        if (updateData.date_of_birth && typeof updateData.date_of_birth === 'string') {
          updateData.date_of_birth = new Date(updateData.date_of_birth);
        }
        if (updateData.date_of_issue && typeof updateData.date_of_issue === 'string') {
          updateData.date_of_issue = new Date(updateData.date_of_issue);
        }
        if (updateData.date_of_expiry && typeof updateData.date_of_expiry === 'string') {
          updateData.date_of_expiry = new Date(updateData.date_of_expiry);
        }

        return await passportTools.updatePassport(id, updateData);
      }
    );

    registry.registerTool(
      {
        name: 'deletePassport',
        description: 'Delete a passport record by ID. Use this to remove passport information.',
        parameters: z.object({
          id: z.number().describe('ID of the passport record to delete'),
        }),
        category: 'passport'
      },
      async (params: Record<string, unknown>) => {
        const { id } = params as { id: number };
        return await passportTools.deletePassport(id);
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
