import { CalendarTools } from '../tools/calendar-tools';
import { EmailTools } from '../tools/email-tools';
import { FileTools } from '../tools/file-tools';
import { createToolRegistry } from '../tools/tool-registry';
import { WebTools } from '../tools/web-tools';

// Create mock tools
const mockCalendarTools = {
  getEvents: jest.fn(),
  searchEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as unknown as CalendarTools;

const mockEmailTools = {
  sendEmail: jest.fn(),
  searchEmails: jest.fn(),
  replyToEmail: jest.fn(),
} as unknown as EmailTools;

const mockFileTools = {
  listFiles: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  searchFiles: jest.fn(),
} as unknown as FileTools;

const mockWebTools = {
  searchWeb: jest.fn(),
  getWebPageContent: jest.fn(),
  summarizeWebPage: jest.fn(),
  checkWebsite: jest.fn(),
} as unknown as WebTools;

describe('Tool Configuration Integration', () => {
  it('should respect the current enabled-tools.json configuration', () => {
    // Create registry with all possible tools
    const registry = createToolRegistry(
      mockCalendarTools,
      mockEmailTools,
      mockFileTools,
      mockWebTools
    );

    // Based on current settings (only calendar enabled)
    const availableCategories = registry.getAvailableCategories();
    console.log('Available categories:', availableCategories);

    const allTools = registry.getAvailableTools();
    console.log('All available tools:', allTools.map(t => `${t.category}:${t.name}`));

    // Should only have calendar tools enabled based on current config
    expect(availableCategories).toEqual(['calendar']);

    const calendarTools = registry.getToolsByCategory('calendar');
    expect(calendarTools).toHaveLength(5);

    // Verify that other categories are not available
    const emailTools = registry.getToolsByCategory('email');
    const fileTools = registry.getToolsByCategory('file');
    const webTools = registry.getToolsByCategory('web');

    expect(emailTools).toHaveLength(0);
    expect(fileTools).toHaveLength(0);
    expect(webTools).toHaveLength(0);
  });
});
