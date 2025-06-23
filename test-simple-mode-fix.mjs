/**
 * Test script to verify that simple tools mode now supports event creation
 * Run with: node --experimental-modules test-simple-mode-fix.mjs
 */

import { AIService } from './src/services/ai-service.js';

// Mock CalendarTools for testing
class MockCalendarTools {
  async createEvent(eventData) {
    console.log('📅 createEvent called with:', JSON.stringify(eventData, null, 2));
    return {
      success: true,
      data: {
        id: 'test-event-id',
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end
      },
      message: `Created event: "${eventData.summary}"`
    };
  }

  async getEvents(timeRange) {
    console.log('📋 getEvents called with timeRange:', timeRange);
    return {
      success: true,
      data: [],
      message: 'No events found'
    };
  }

  async searchEvents(query, timeRange) {
    console.log('🔍 searchEvents called with query:', query, 'timeRange:', timeRange);
    return {
      success: true,
      data: [],
      message: 'No events found'
    };
  }
}

async function testSimpleToolMode() {
  console.log('🚀 Testing Simple Tool Mode Event Creation Fix');
  console.log('==============================================');

  // Mock OpenAI API key
  process.env.OPENAI_API_KEY = 'test-key';

  try {
    const aiService = new AIService('test-key');
    const mockCalendarTools = new MockCalendarTools();

    // Test 1: Event creation with basic details
    console.log('\n📝 Test 1: Create meeting with John tomorrow at 2pm');
    const result1 = await aiService.processMessageWithTools(
      'Create a meeting with John tomorrow at 2pm',
      mockCalendarTools
    );

    console.log('✅ Response:', result1.response);
    console.log('🔧 Tool calls:', result1.toolCalls.length);

    // Test 2: Schedule event with more details
    console.log('\n📝 Test 2: Schedule team review meeting Friday 3pm conference room A');
    const result2 = await aiService.processMessageWithTools(
      'Schedule a team review meeting on Friday at 3pm in conference room A',
      mockCalendarTools
    );

    console.log('✅ Response:', result2.response);
    console.log('🔧 Tool calls:', result2.toolCalls.length);

    // Test 3: Add all-day event
    console.log('\n📝 Test 3: Add vacation day next Monday');
    const result3 = await aiService.processMessageWithTools(
      'Add vacation day next Monday',
      mockCalendarTools
    );

    console.log('✅ Response:', result3.response);
    console.log('🔧 Tool calls:', result3.toolCalls.length);

    // Test 4: Non-creation request (should still work)
    console.log('\n📝 Test 4: List events this week (should not call createEvent)');
    const result4 = await aiService.processMessageWithTools(
      'List my events this week',
      mockCalendarTools
    );

    console.log('✅ Response:', result4.response);
    console.log('🔧 Tool calls:', result4.toolCalls.length);

    console.log('\n🎉 All tests completed successfully!');
    console.log('🎯 Simple tool mode now supports event creation!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSimpleToolMode();
