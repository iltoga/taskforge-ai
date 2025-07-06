import { CalendarTools } from '../tools/calendar-tools';
import { PassportTools } from '../tools/passport-tools';
import { createToolRegistry } from '../tools/tool-registry';

// Create mock tools
const mockCalendarTools = {
  getEvents: jest.fn(),
  searchEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as unknown as CalendarTools;

const mockPassportTools = {
  setupSchema: jest.fn(),
  createPassport: jest.fn(),
  getPassports: jest.fn(),
  updatePassport: jest.fn(),
  deletePassport: jest.fn(),
} as unknown as PassportTools;

describe('Passport Tools Integration', () => {
  it('should include passport tools when provided and enabled', () => {
    // Create registry with passport tools explicitly enabled
    const registry = createToolRegistry(
      mockCalendarTools,
      undefined,
      undefined,
      undefined,
      mockPassportTools,
      { calendar: true, passport: true } // Config override
    );

    const availableCategories = registry.getAvailableCategories();
    console.log('Available categories:', availableCategories);

    const allTools = registry.getAvailableTools();
    console.log('All available tools:', allTools.map(t => `${t.category}:${t.name}`));

    // Should have both calendar and passport tools
    expect(availableCategories).toContain('calendar');
    expect(availableCategories).toContain('passport');

    const calendarTools = registry.getToolsByCategory('calendar');
    expect(calendarTools).toHaveLength(5);

    const passportTools = registry.getToolsByCategory('passport');
    expect(passportTools).toHaveLength(5); // setupSchema, create, get, update, delete

    const passportToolNames = passportTools.map(t => t.name);
    expect(passportToolNames).toContain('setupPassportSchema');
    expect(passportToolNames).toContain('createPassport');
    expect(passportToolNames).toContain('getPassports');
    expect(passportToolNames).toContain('updatePassport');
    expect(passportToolNames).toContain('deletePassport');
  });

  it('should not include passport tools when disabled in configuration', () => {
    // Create registry with passport tools explicitly disabled
    const registry = createToolRegistry(
      mockCalendarTools,
      undefined,
      undefined,
      undefined,
      mockPassportTools,
      { calendar: true, passport: false } // Config override
    );

    const availableCategories = registry.getAvailableCategories();
    expect(availableCategories).toEqual(['calendar']); // Only calendar
    expect(availableCategories).not.toContain('passport');

    const passportTools = registry.getToolsByCategory('passport');
    expect(passportTools).toHaveLength(0);
  });
});
