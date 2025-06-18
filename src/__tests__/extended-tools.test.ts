import { CalendarService } from '../services/calendar-service';
import { CalendarTools } from '../tools/calendar-tools';
import { EmailTools } from '../tools/email-tools';
import { FileTools } from '../tools/file-tools';
import { createToolRegistry } from '../tools/tool-registry';
import { WebTools } from '../tools/web-tools';

// Mock the calendar service
jest.mock('../services/calendar-service');
const MockCalendarService = CalendarService as jest.MockedClass<typeof CalendarService>;

describe('Extended Tool Categories', () => {
  let mockCalendarService: jest.Mocked<CalendarService>;
  let calendarTools: CalendarTools;
  let emailTools: EmailTools;
  let fileTools: FileTools;
  let webTools: WebTools;

  beforeEach(() => {
    mockCalendarService = new MockCalendarService({} as any) as jest.Mocked<CalendarService>;
    calendarTools = new CalendarTools(mockCalendarService);
    emailTools = new EmailTools();
    fileTools = new FileTools();
    webTools = new WebTools();
  });

  describe('Tool Registry Extension', () => {
    it('should register all tool categories', () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);
      const tools = registry.getAvailableTools();

      expect(tools.length).toBeGreaterThan(5); // Should have calendar + email + file + web tools

      // Check for calendar tools
      expect(tools.some(tool => tool.name === 'getEvents')).toBe(true);
      expect(tools.some(tool => tool.name === 'createEvent')).toBe(true);

      // Check for email tools
      expect(tools.some(tool => tool.name === 'sendEmail')).toBe(true);
      expect(tools.some(tool => tool.name === 'searchEmails')).toBe(true);

      // Check for file tools
      expect(tools.some(tool => tool.name === 'listFiles')).toBe(true);
      expect(tools.some(tool => tool.name === 'readFile')).toBe(true);

      // Check for web tools
      expect(tools.some(tool => tool.name === 'searchWeb')).toBe(true);
      expect(tools.some(tool => tool.name === 'getWebPageContent')).toBe(true);
    });

    it('should categorize tools correctly', () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);
      const categories = registry.getAvailableCategories();

      expect(categories).toContain('calendar');
      expect(categories).toContain('email');
      expect(categories).toContain('file');
      expect(categories).toContain('web');
    });

    it('should get tools by category', () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const calendarToolsList = registry.getToolsByCategory('calendar');
      expect(calendarToolsList.length).toBeGreaterThan(0);
      expect(calendarToolsList.every(tool => tool.category === 'calendar')).toBe(true);

      const emailToolsList = registry.getToolsByCategory('email');
      expect(emailToolsList.length).toBeGreaterThan(0);
      expect(emailToolsList.every(tool => tool.category === 'email')).toBe(true);

      const fileToolsList = registry.getToolsByCategory('file');
      expect(fileToolsList.length).toBeGreaterThan(0);
      expect(fileToolsList.every(tool => tool.category === 'file')).toBe(true);

      const webToolsList = registry.getToolsByCategory('web');
      expect(webToolsList.length).toBeGreaterThan(0);
      expect(webToolsList.every(tool => tool.category === 'web')).toBe(true);
    });
  });

  describe('Email Tools', () => {
    it('should send email successfully', async () => {
      const emailData = {
        to: ['test@example.com'],
        subject: 'Test Email',
        body: 'This is a test email body.'
      };

      const result = await emailTools.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email sent successfully');
      expect(result.data).toHaveProperty('messageId');
    });

    it('should search emails with filters', async () => {
      const filters = {
        from: 'john@example.com',
        subject: 'Project',
        maxResults: 5
      };

      const result = await emailTools.searchEmails(filters);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should reply to email', async () => {
      const result = await emailTools.replyToEmail('email_123', {
        body: 'Thank you for your email.',
        replyAll: false
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Reply sent successfully');
    });
  });

  describe('File Tools', () => {
    it('should list files in directory', async () => {
      const result = await fileTools.listFiles('/test/directory');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should read file content', async () => {
      const result = await fileTools.readFile('/test/file.txt');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully read');
      expect(result.data).toHaveProperty('content');
    });

    it('should write file content', async () => {
      const result = await fileTools.writeFile('/test/newfile.txt', 'Hello, World!');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully wrote');
      expect(result.data).toHaveProperty('fileId');
    });

    it('should search files with filters', async () => {
      const filters = {
        name: '*.txt',
        type: 'file' as const,
        maxResults: 10
      };

      const result = await fileTools.searchFiles('/search/path', filters);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should create directory', async () => {
      const result = await fileTools.createDirectory('/new/directory');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully created directory');
    });

    it('should copy file', async () => {
      const result = await fileTools.copyFile('/source/file.txt', '/dest/file.txt');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully copied');
    });

    it('should move file', async () => {
      const result = await fileTools.moveFile('/old/path.txt', '/new/path.txt');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully moved');
    });
  });

  describe('Web Tools', () => {
    it('should search web with query', async () => {
      const result = await webTools.searchWeb('artificial intelligence');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should search web with filters', async () => {
      const filters = {
        site: 'example.com',
        maxResults: 5
      };

      const result = await webTools.searchWeb('test query', filters);

      expect(result.success).toBe(true);
      expect(result.message).toContain('search results');
    });

    it('should get web page content', async () => {
      const result = await webTools.getWebPageContent('https://example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully retrieved content');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('title');
    });

    it('should summarize web page', async () => {
      const result = await webTools.summarizeWebPage('https://example.com', 200);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Generated summary');
      expect(result.data).toHaveProperty('summary');
    });

    it('should check website accessibility', async () => {
      const result = await webTools.checkWebsite('https://example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('accessible');
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('isAccessible');
    });

    it('should extract links from web page', async () => {
      const result = await webTools.extractLinks('https://example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Extracted');
      expect(result.data).toHaveProperty('links');
    });

    it('should set up website monitoring', async () => {
      const result = await webTools.monitorWebsite('https://example.com', 3600000);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Started monitoring');
      expect(result.data).toHaveProperty('monitorId');
    });
  });

  describe('Tool Registry Execution', () => {
    it('should execute calendar tools through registry', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      mockCalendarService.getEvents.mockResolvedValue({
        items: [
          {
            id: 'event1',
            summary: 'Test Event',
            start: { dateTime: '2024-06-15T10:00:00Z' },
            end: { dateTime: '2024-06-15T11:00:00Z' }
          }
        ]
      });

      const result = await registry.executeTool('getEvents', {
        timeRange: {
          start: '2024-06-15T00:00:00Z',
          end: '2024-06-16T00:00:00Z'
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Retrieved');
    });

    it('should execute email tools through registry', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const result = await registry.executeTool('sendEmail', {
        emailData: {
          to: ['test@example.com'],
          subject: 'Test',
          body: 'Hello'
        }
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email sent successfully');
    });

    it('should execute file tools through registry', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const result = await registry.executeTool('listFiles', {
        directoryPath: '/test'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
    });

    it('should execute web tools through registry', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const result = await registry.executeTool('searchWeb', {
        query: 'test search'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('search results');
    });

    it('should handle unknown tool execution', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const result = await registry.executeTool('unknownTool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate tool parameters', async () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      // Test with invalid parameters for sendEmail (missing required fields)
      const result = await registry.executeTool('sendEmail', {
        emailData: {
          // Missing required 'to' and 'subject' fields
          body: 'Hello'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Extensibility Pattern', () => {
    it('should demonstrate easy tool category addition', () => {
      // This test demonstrates how easy it is to add new tool categories
      const registryBasic = createToolRegistry(calendarTools);
      const toolsBasic = registryBasic.getAvailableTools();

      const registryExtended = createToolRegistry(calendarTools, emailTools, fileTools, webTools);
      const toolsExtended = registryExtended.getAvailableTools();

      expect(toolsExtended.length).toBeGreaterThan(toolsBasic.length);
      expect(registryExtended.getAvailableCategories().length).toBe(4); // calendar, email, file, web
    });

    it('should maintain tool isolation between categories', () => {
      const registry = createToolRegistry(calendarTools, emailTools, fileTools, webTools);

      const calendarTools_list = registry.getToolsByCategory('calendar');
      const emailTools_list = registry.getToolsByCategory('email');
      const fileTools_list = registry.getToolsByCategory('file');
      const webTools_list = registry.getToolsByCategory('web');

      // Ensure no cross-contamination between categories
      expect(calendarTools_list.every(tool => tool.category === 'calendar')).toBe(true);
      expect(emailTools_list.every(tool => tool.category === 'email')).toBe(true);
      expect(fileTools_list.every(tool => tool.category === 'file')).toBe(true);
      expect(webTools_list.every(tool => tool.category === 'web')).toBe(true);
    });
  });
});
