import { z } from 'zod';
import { EmailTools } from './email-tools';
import { ToolRegistry } from './tool-registry';

export function registerEmailTools(registry: ToolRegistry, emailTools: EmailTools) {
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
