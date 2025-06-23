#!/usr/bin/env node

/**
 * Quick debug script to test vector store IDs are being passed correctly
 */

import dotenv from 'dotenv';
import { ToolOrchestrator } from './src/services/tool-orchestrator.ts';
import { registerKnowledgeTools } from './src/tools/knowledge-tools.ts';
import { DefaultToolRegistry } from './src/tools/tool-registry.ts';

// Load environment variables
dotenv.config();

async function debugVectorStoreIds() {
  console.log('🔍 Testing vector store IDs integration...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    const orchestrator = new ToolOrchestrator(apiKey);

    // Capture logs
    const logs = [];
    orchestrator.setProgressCallback((message) => {
      logs.push(message);
      console.log(message);
    });

    const toolRegistry = new DefaultToolRegistry();
    registerKnowledgeTools(toolRegistry);

    const userMessage = 'I am italian, what type of visa to indonesia can I get?';

    console.log(`📝 Testing with query: "${userMessage}"\n`);

    const result = await orchestrator.orchestrate(
      userMessage,
      [],
      toolRegistry,
      'gpt-4.1-mini-2025-04-14',
      { maxSteps: 2, maxToolCalls: 1, developmentMode: true }
    );

    console.log('\n📊 Analysis:');
    console.log('Success:', result.success);
    console.log('Tool calls:', result.toolCalls.length);

    if (result.toolCalls.length > 0) {
      const vectorSearchCall = result.toolCalls.find(call => call.tool === 'vectorFileSearch');
      if (vectorSearchCall) {
        console.log('\n✅ vectorFileSearch was called');
        console.log('Parameters:', JSON.stringify(vectorSearchCall.parameters, null, 2));

        if (vectorSearchCall.parameters.vectorStoreIds) {
          console.log('✅ vectorStoreIds parameter present:', vectorSearchCall.parameters.vectorStoreIds);
        } else {
          console.log('❌ vectorStoreIds parameter missing');
        }
      } else {
        console.log('❌ vectorFileSearch was not called');
      }
    } else {
      console.log('❌ No tools were called');
    }

    // Check logs for vector store ID references
    const vectorStoreIdLogs = logs.filter(log =>
      log.includes('vectorStoreIds') && !log.includes('N/A')
    );

    if (vectorStoreIdLogs.length > 0) {
      console.log('\n📚 Vector Store ID logs found:');
      vectorStoreIdLogs.forEach(log => console.log('  -', log));
    } else {
      console.log('\n❌ No vector store ID logs found');
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error(error);
  }
}

debugVectorStoreIds().catch(console.error);
