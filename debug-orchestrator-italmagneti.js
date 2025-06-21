/**
 * Debug script to test orchestrator behavior with italmagneti query
 * This will help identify if the issue is with orchestrator or agent
 */

import { CalendarService } from './src/services/calendar-service.js';
import { ToolOrchestrator } from './src/services/tool-orchestrator.js';
import { CalendarTools } from './src/tools/calendar-tools.js';
import { createToolRegistry } from './src/tools/tool-registry.js';

// Mock Google Auth for testing
const mockGoogleAuth = {
  calendar: () => ({
    events: {
      list: async () => ({
        data: {
          items: [
            {
              id: 'test-event-1',
              summary: 'Italmagneti Project Planning Meeting',
              start: { dateTime: '2025-03-15T10:00:00Z' },
              end: { dateTime: '2025-03-15T11:00:00Z' },
              description: 'Discussing core objectives for Italmagneti collaboration project'
            },
            {
              id: 'test-event-2',
              summary: 'Italmagneti Technical Review',
              start: { dateTime: '2025-04-20T14:00:00Z' },
              end: { dateTime: '2025-04-20T16:00:00Z' },
              description: 'Core technical evaluation for the Italmagneti industrial automation project'
            }
          ]
        }
      })
    }
  })
};

async function debugOrchestratorWithItalmagneti() {
  console.log('🔍 Starting orchestrator debug test for Italmagneti query...\n');

  try {
    // Setup services with mock data
    const calendarService = new CalendarService(mockGoogleAuth);
    const calendarTools = new CalendarTools(calendarService);
    const toolRegistry = createToolRegistry(calendarTools, null, null, null);

    // Initialize orchestrator
    const orchestrator = new ToolOrchestrator(process.env.OPENAI_API_KEY);

    // Test the exact query from the screenshot
    const userMessage = "what was the core reason for the project I've been working for in italmagneti in 2025";
    const chatHistory = [];

    console.log(`📝 User Query: "${userMessage}"`);
    console.log(`🤖 Model: gpt-4o-mini`);
    console.log(`⚙️ Development Mode: true\n`);

    const startTime = Date.now();

    const result = await orchestrator.orchestrate(
      userMessage,
      chatHistory,
      toolRegistry,
      'gpt-4o-mini',
      {
        maxSteps: 10,
        maxToolCalls: 5,
        developmentMode: true
      }
    );

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(50));
    console.log('📊 ORCHESTRATION RESULTS');
    console.log('='.repeat(50));
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Steps: ${result.steps?.length || 0}`);
    console.log(`🛠️  Tool Calls: ${result.toolCalls?.length || 0}`);

    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('\n🔧 TOOL EXECUTIONS:');
      result.toolCalls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.tool}`);
        console.log(`     Parameters: ${JSON.stringify(call.parameters, null, 2)}`);
        console.log(`     Success: ${call.result.success}`);
        console.log(`     Duration: ${call.duration}ms`);
        if (call.result.success && call.result.data) {
          const dataStr = typeof call.result.data === 'object'
            ? JSON.stringify(call.result.data, null, 2).substring(0, 300) + '...'
            : call.result.data;
          console.log(`     Data: ${dataStr}`);
        }
        if (!call.result.success) {
          console.log(`     Error: ${call.result.error || call.result.message}`);
        }
        console.log('');
      });
    }

    if (result.steps && result.steps.length > 0) {
      console.log('\n📋 PROCESSING STEPS:');
      result.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. [${step.id}] ${step.type.toUpperCase()}`);
        const content = step.content.length > 200 ? step.content.substring(0, 200) + '...' : step.content;
        console.log(`     Content: ${content}`);
        if (step.reasoning) {
          console.log(`     Reasoning: ${step.reasoning}`);
        }
        console.log('');
      });
    }

    console.log('\n🎯 FINAL ANSWER:');
    console.log('-'.repeat(30));
    console.log(result.finalAnswer);
    console.log('-'.repeat(30));

    if (result.error) {
      console.log(`\n❌ Error: ${result.error}`);
    }

    // Analysis
    console.log('\n🔍 ANALYSIS:');

    if (result.toolCalls && result.toolCalls.length > 0) {
      const calendarToolCalls = result.toolCalls.filter(call =>
        call.tool === 'searchEvents' || call.tool === 'getEvents'
      );

      if (calendarToolCalls.length > 0) {
        console.log('✅ Calendar tools were called');
        const successfulCalls = calendarToolCalls.filter(call => call.result.success);
        console.log(`📊 Successful calendar tool calls: ${successfulCalls.length}/${calendarToolCalls.length}`);

        if (successfulCalls.length > 0) {
          console.log('✅ Tools returned data - issue is likely in SYNTHESIS STEP');
        } else {
          console.log('❌ Tools failed - issue is in TOOL EXECUTION');
        }
      } else {
        console.log('❌ No calendar tools called - issue is in ORCHESTRATOR PLANNING');
      }
    } else {
      console.log('❌ No tools called at all - issue is in ORCHESTRATOR DECISION MAKING');
    }

    // Check if final answer is generic
    const isGenericAnswer = result.finalAnswer.toLowerCase().includes('acknowledged') ||
                            result.finalAnswer.toLowerCase().includes('please let me know') ||
                            result.finalAnswer.toLowerCase().includes('how can i assist');

    if (isGenericAnswer) {
      console.log('⚠️  FINAL ANSWER IS GENERIC - this confirms the issue');
    } else {
      console.log('✅ Final answer appears specific to the query');
    }

  } catch (error) {
    console.error('💥 Debug test failed:', error);
  }
}

// Run the debug test
debugOrchestratorWithItalmagneti();
