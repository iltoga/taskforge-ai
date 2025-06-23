import { AIService } from './src/services/ai-service.js';

async function testFixedEventSummary() {
  try {
    console.log('🧪 Testing fixed event summary generation...');

    // Create mock SimplifiedEvent objects (the format returned by CalendarTools)
    const mockEvents = [
      {
        id: '1',
        title: 'Weekly Team Meeting',
        description: 'Regular team sync meeting',
        startDate: '2025-06-16T10:00:00Z',
        endDate: '2025-06-16T11:00:00Z',
        isAllDay: false,
        location: 'Conference Room A',
        status: 'confirmed'
      },
      {
        id: '2',
        title: 'Project Review',
        startDate: '2025-06-17T14:00:00Z',
        endDate: '2025-06-17T15:30:00Z',
        isAllDay: false,
        status: 'confirmed'
      },
      {
        id: '3',
        title: 'All Day Event',
        startDate: '2025-06-18',
        endDate: '2025-06-18',
        isAllDay: true,
        status: 'confirmed'
      }
    ];

    // Test the generateEventSummary method directly
    const aiService = new AIService(process.env.OPENAI_API_KEY);

    console.log('📝 Testing with mock events:', JSON.stringify(mockEvents, null, 2));

    // This should now work correctly with the SimplifiedEvent format
    const summary = await aiService.generateEventSummary(
      mockEvents,
      'summarize last week calendar activities',
      'test calendar events'
    );

    console.log('✅ Generated summary:');
    console.log(summary);
    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFixedEventSummary();
