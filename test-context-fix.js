/**
 * Simple test to verify internal conversation context fix
 */

const { ToolOrchestrator } = require('./src/services/tool-orchestrator.ts');
const { CalendarTools } = require('./src/tools/calendar-tools.ts');
const { createToolRegistry } = require('./src/tools/tool-registry.ts');

// Mock calendar service
const mockCalendarService = {
  getEvents: jest.fn().mockResolvedValue([
    {
      id: 'event1',
      summary: 'Italmagneti Project Meeting',
      description: 'Discussing core reasons for the 2025 project',
      start: { dateTime: '2025-03-15T10:00:00Z' },
      end: { dateTime: '2025-03-15T11:00:00Z' }
    }
  ])
};

async function testInternalContext() {
  console.log('🧪 Testing internal conversation context...');

  const calendarTools = new CalendarTools(mockCalendarService);
  const toolRegistry = createToolRegistry(calendarTools);
  const orchestrator = new ToolOrchestrator();

  const result = await orchestrator.orchestrate(
    "what was the core reason for the project I've been working for in Italmagneti in 2025",
    [], // empty chat history
    toolRegistry,
    'gpt-4o-mini',
    { maxSteps: 5, maxToolCalls: 3 }
  );

  console.log('📝 Final result:', result.response);
  console.log('🔧 Steps taken:', result.steps?.length || 0);
  console.log('⚙️ Tool calls made:', result.toolCalls?.length || 0);

  return result;
}

if (require.main === module) {
  testInternalContext().catch(console.error);
}

module.exports = { testInternalContext };
