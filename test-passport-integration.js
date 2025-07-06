const { createToolRegistry } = require('./src/tools/tool-registry');
const { PassportTools } = require('./src/tools/passport-tools');

// Create mock tools
const mockCalendarTools = {
  getEvents: () => {},
  searchEvents: () => {},
  createEvent: () => {},
  updateEvent: () => {},
  deleteEvent: () => {},
};

const mockPassportTools = new PassportTools();

// Test the integration
const registry = createToolRegistry(mockCalendarTools, undefined, undefined, undefined, mockPassportTools);

console.log('Available categories:', registry.getAvailableCategories());
console.log('All available tools:', registry.getAvailableTools().map(t => `${t.category}:${t.name}`));

const passportTools = registry.getToolsByCategory('passport');
console.log('Passport tools count:', passportTools.length);
console.log('Passport tools:', passportTools.map(t => t.name));
