const { ToolOrchestrator } = require('./src/services/tool-orchestrator.ts');

async function testItalmagneti() {
  console.log('🔧 Testing Italmagneti query issue...');

  // Mock calendar service that has no events for "italmagneti"
  const mockCalendarService = {
    searchEvents: async (query) => {
      console.log(`📅 Mock searchEvents called with: "${query}"`);
      if (query.toLowerCase().includes('italmagneti')) {
        return { events: [] }; // No events found
      }
      return { events: [{ summary: 'Some other event' }] };
    },
    getEvents: async () => {
      console.log('📅 Mock getEvents called');
      return { events: [] }; // No events found
    }
  };

  // Mock AI service that might fabricate responses
  const mockAIService = {
    processMessage: async (message) => {
      console.log(`🤖 Mock AI processing: "${message}"`);
      // Simulate AI potentially giving irrelevant response
      if (message.includes('translation') || message.includes('english')) {
        return 'The text "progetto Italmagneti" translates to "Italmagneti project" in English.';
      }
      return 'I cannot find specific information about the Italmagneti project in your calendar.';
    }
  };

  const orchestrator = new ToolOrchestrator(mockCalendarService, mockAIService);

  // Test the actual problematic query
  const query = "cosa puoi dirmi sul progetto Italmagneti?";
  console.log(`\n🎯 Testing query: "${query}"`);

  try {
    const result = await orchestrator.orchestrate(query, {
      maxSteps: 10,
      maxToolCalls: 5
    });

    console.log('\n📊 Result:', result);
    console.log('\n📝 Response:', result.response);

    // Check if the response is relevant to the calendar query
    const response = result.response.toLowerCase();
    const isRelevantToCalendar = response.includes('calendar') ||
                                response.includes('event') ||
                                response.includes('meeting') ||
                                response.includes('no data') ||
                                response.includes('no information') ||
                                response.includes('not found');

    const isTranslationResponse = response.includes('translation') ||
                                 response.includes('translate') ||
                                 response.includes('english');

    if (isTranslationResponse) {
      console.log('❌ PROBLEM: Orchestrator gave translation response instead of calendar response!');
    } else if (isRelevantToCalendar) {
      console.log('✅ Good: Response is relevant to calendar query');
    } else {
      console.log('⚠️ Response relevance unclear');
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testItalmagneti().catch(console.error);
