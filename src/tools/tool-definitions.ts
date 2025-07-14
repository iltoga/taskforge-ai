import { z } from "zod";

// Zod schemas for tool parameters
export const TimeRangeSchema = z.object({
  start: z.string().optional().describe("ISO date string for start time"),
  end: z.string().optional().describe("ISO date string for end time"),
});

export const EventFiltersSchema = z.object({
  query: z.string().optional().describe("Search query to filter events"),
  maxResults: z
    .number()
    .optional()
    .describe("Maximum number of results to return"),
  showDeleted: z
    .boolean()
    .optional()
    .describe("Whether to include deleted events"),
  orderBy: z
    .enum(["startTime", "updated"])
    .optional()
    .describe("How to order results"),
});

export const CalendarEventSchema = z.object({
  summary: z.string().describe("Event title/summary"),
  description: z.string().optional().describe("Event description"),
  start: z
    .object({
      dateTime: z.string().optional().describe("Start date-time (ISO format)"),
      date: z
        .string()
        .optional()
        .describe("Start date for all-day events (YYYY-MM-DD)"),
      timeZone: z.string().optional().describe("Time zone"),
    })
    .describe("Event start time"),
  end: z
    .object({
      dateTime: z.string().optional().describe("End date-time (ISO format)"),
      date: z
        .string()
        .optional()
        .describe("End date for all-day events (YYYY-MM-DD)"),
      timeZone: z.string().optional().describe("Time zone"),
    })
    .describe("Event end time"),
  location: z.string().optional().describe("Event location"),
  attendees: z
    .array(
      z.object({
        email: z.string().describe("Attendee email"),
        displayName: z.string().optional().describe("Attendee display name"),
      })
    )
    .optional()
    .describe("Event attendees"),
});

// Email tool schemas
export const EmailMessageSchema = z.object({
  to: z.array(z.string()).describe("Recipient email addresses"),
  cc: z.array(z.string()).optional().describe("CC email addresses"),
  bcc: z.array(z.string()).optional().describe("BCC email addresses"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body content"),
  priority: z
    .enum(["low", "normal", "high"])
    .optional()
    .describe("Email priority"),
  isHtml: z.boolean().optional().describe("Whether the body contains HTML"),
});

export const EmailSearchFiltersSchema = z.object({
  from: z.string().optional().describe("Filter by sender email"),
  to: z.string().optional().describe("Filter by recipient email"),
  subject: z.string().optional().describe("Filter by subject keywords"),
  body: z.string().optional().describe("Filter by body content"),
  hasAttachment: z
    .boolean()
    .optional()
    .describe("Filter by attachment presence"),
  isRead: z.boolean().optional().describe("Filter by read/unread status"),
  dateRange: z
    .object({
      start: z.string().optional().describe("Start date for search range"),
      end: z.string().optional().describe("End date for search range"),
    })
    .optional()
    .describe("Date range filter"),
  maxResults: z.number().optional().describe("Maximum number of results"),
});

// File tool schemas
export const FileSearchFiltersSchema = z.object({
  name: z.string().optional().describe("Filter by file name pattern"),
  extension: z.string().optional().describe("Filter by file extension"),
  type: z
    .enum(["file", "directory"])
    .optional()
    .describe("Filter by file type"),
  sizeMin: z.number().optional().describe("Minimum file size in bytes"),
  sizeMax: z.number().optional().describe("Maximum file size in bytes"),
  createdAfter: z
    .string()
    .optional()
    .describe("Filter by creation date (after)"),
  createdBefore: z
    .string()
    .optional()
    .describe("Filter by creation date (before)"),
  modifiedAfter: z
    .string()
    .optional()
    .describe("Filter by modification date (after)"),
  modifiedBefore: z
    .string()
    .optional()
    .describe("Filter by modification date (before)"),
  maxResults: z.number().optional().describe("Maximum number of results"),
});

// Web tool schemas
export const WebSearchFiltersSchema = z.object({
  site: z.string().optional().describe("Limit search to specific site"),
  dateRange: z
    .object({
      start: z.string().optional().describe("Start date for search range"),
      end: z.string().optional().describe("End date for search range"),
    })
    .optional()
    .describe("Date range filter"),
  language: z
    .string()
    .optional()
    .describe('Language filter (e.g., "en", "es")'),
  region: z.string().optional().describe('Region filter (e.g., "US", "UK")'),
  maxResults: z.number().optional().describe("Maximum number of results"),
});

// Tool definitions for AI function calling
export const calendarToolDefinitions = {
  getEvents: {
    description:
      "Get calendar events within a time range with optional filters",
    parameters: z.object({
      timeRange: TimeRangeSchema.optional().describe(
        "Time range to search for events"
      ),
      filters: EventFiltersSchema.optional().describe(
        "Additional filters for events"
      ),
    }),
  },

  createEvent: {
    description: "Create a new calendar event",
    parameters: z.object({
      eventData: CalendarEventSchema.describe("Event data to create"),
    }),
  },

  updateEvent: {
    description: "Update an existing calendar event",
    parameters: z.object({
      eventId: z.string().describe("ID of the event to update"),
      changes: CalendarEventSchema.partial().describe(
        "Changes to apply to the event"
      ),
    }),
  },

  deleteEvent: {
    description: "Delete a calendar event",
    parameters: z.object({
      eventId: z.string().describe("ID of the event to delete"),
    }),
  },

  searchEvents: {
    description: "Search calendar events by query string",
    parameters: z.object({
      query: z.string().describe("Search query to find events"),
      timeRange: TimeRangeSchema.optional().describe(
        "Time range to search within"
      ),
    }),
  },
};

// Email tool definitions
export const emailToolDefinitions = {
  sendEmail: {
    description: "Send an email message to recipients",
    parameters: z.object({
      emailData: EmailMessageSchema.describe("Email message data"),
    }),
  },

  searchEmails: {
    description: "Search for emails with various filters",
    parameters: z.object({
      filters: EmailSearchFiltersSchema.describe("Search filters for emails"),
    }),
  },

  getEmail: {
    description: "Get details of a specific email by ID",
    parameters: z.object({
      emailId: z.string().describe("ID of the email to retrieve"),
    }),
  },

  replyToEmail: {
    description: "Reply to an existing email",
    parameters: z.object({
      emailId: z.string().describe("ID of the email to reply to"),
      replyData: z
        .object({
          body: z.string().describe("Reply message body"),
          replyAll: z
            .boolean()
            .optional()
            .describe("Whether to reply to all recipients"),
        })
        .describe("Reply content and options"),
    }),
  },

  markEmail: {
    description: "Mark an email as read or unread",
    parameters: z.object({
      emailId: z.string().describe("ID of the email to mark"),
      action: z.enum(["read", "unread"]).describe("Action to perform"),
    }),
  },
};

// Web tool definitions
export const webToolDefinitions = {
  searchWeb: {
    description: "Search the web for information using search engines",
    parameters: z.object({
      query: z.string().describe("Search query"),
      filters: WebSearchFiltersSchema.optional().describe("Search filters"),
    }),
  },

  getWebPageContent: {
    description: "Get the content of a specific web page",
    parameters: z.object({
      url: z.string().describe("URL of the web page to fetch"),
    }),
  },

  summarizeWebPage: {
    description: "Get a summary of a web page content",
    parameters: z.object({
      url: z.string().describe("URL of the web page to summarize"),
      maxLength: z
        .number()
        .optional()
        .describe("Maximum length of the summary"),
    }),
  },

  checkWebsite: {
    description: "Check if a website is accessible and get status information",
    parameters: z.object({
      url: z.string().describe("URL of the website to check"),
    }),
  },

  extractLinks: {
    description: "Extract all links from a web page",
    parameters: z.object({
      url: z.string().describe("URL of the web page to extract links from"),
      filterPattern: z.string().optional().describe("Pattern to filter links"),
    }),
  },

  monitorWebsite: {
    description: "Set up monitoring for a website to detect changes",
    parameters: z.object({
      url: z.string().describe("URL of the website to monitor"),
      checkInterval: z
        .number()
        .optional()
        .describe("Check interval in milliseconds"),
    }),
  },
};

// File search tool definitions
export const fileSearchToolDefinitions = {
  searchFiles: {
    description: "Search through uploaded files using natural language queries",
    parameters: z.object({
      query: z.string().describe("Natural language search query"),
    }),
  },
  initializeFileSearch: {
    description: "Initialize file search by uploading files",
    parameters: z.object({
      files: z
        .array(
          z.object({
            name: z.string().describe("File name"),
            size: z.number().describe("File size in bytes"),
            type: z.string().describe("File type (e.g., image, pdf)"),
            isImage: z.boolean().optional().describe("Is this an image file?"),
            convertedImages: z
              .array(z.string())
              .optional()
              .describe(
                "Array of image file names if this is a multi-page document"
              ),
            totalImageSize: z
              .number()
              .optional()
              .describe(
                "Total size of all images if this is a multi-page document"
              ),
          })
        )
        .describe("Array of files to upload for search"),
    }),
  },

  getDocumentByName: {
    description:
      "Retrieve a specific document previously uploaded (passport, image or other) by its filename (complete with extension) from db",
    parameters: z.object({
      name: z.string().describe("Name of the document to retrieve"),
    }),
  },

  cleanupFiles: {
    description: "Clean up uploaded files and resources",
    parameters: z.object({
      deleteDiskFiles: z
        .boolean()
        .optional()
        .describe("Whether to delete uploaded files from disk"),
    }),
  },
};

// File categorizer tool definition
export const fileCategorizerToolDefinition = {
  description:
    "Categorize a file (text or image) using LLM document categorization. Returns a string category. Accepts a file name.",
  parameters: z.object({
    fileName: z
      .string()
      .describe(
        "file name with extension (e.g., passport_francisco.pdf, image.jpg)"
      ),
  }),
};

// Type exports for TypeScript
export type CalendarToolName = keyof typeof calendarToolDefinitions;
export type EmailToolName = keyof typeof emailToolDefinitions;
export type WebToolName = keyof typeof webToolDefinitions;
export type FileSearchToolName = keyof typeof fileSearchToolDefinitions;

export type CalendarToolParameters<T extends CalendarToolName> = z.infer<
  (typeof calendarToolDefinitions)[T]["parameters"]
>;
export type EmailToolParameters<T extends EmailToolName> = z.infer<
  (typeof emailToolDefinitions)[T]["parameters"]
>;
export type WebToolParameters<T extends WebToolName> = z.infer<
  (typeof webToolDefinitions)[T]["parameters"]
>;
export type FileSearchToolParameters<T extends FileSearchToolName> = z.infer<
  (typeof fileSearchToolDefinitions)[T]["parameters"]
>;
