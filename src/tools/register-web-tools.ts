import { z } from 'zod';
import { ToolRegistry } from './tool-registry';
import { WebTools } from './web-tools';

export function registerWebTools(registry: ToolRegistry, webTools: WebTools) {
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
