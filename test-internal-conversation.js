// Simple test to verify that internalConversation is being used in all orchestrator steps
console.log('Testing internal conversation usage...');

// Read the orchestrator file and check if internalConversation is used in prompts
const fs = require('fs');
const path = require('path');

const orchestratorPath = path.join(__dirname, 'src/services/tool-orchestrator.ts');
const content = fs.readFileSync(orchestratorPath, 'utf8');

// Check if internalConversation is used in decideToolUsage
const decideToolUsageMatch = content.match(/decideToolUsage[\s\S]*?## INTERNAL PROCESS CONTEXT[\s\S]*?formatInternalConversation/);
if (decideToolUsageMatch) {
  console.log('✅ decideToolUsage method now uses internalConversation');
} else {
  console.log('❌ decideToolUsage method does not use internalConversation');
}

// Check if internalConversation is used in evaluateProgress
const evaluateProgressMatch = content.match(/evaluateProgress[\s\S]*?## INTERNAL PROCESS CONTEXT[\s\S]*?formatInternalConversation/);
if (evaluateProgressMatch) {
  console.log('✅ evaluateProgress method now uses internalConversation');
} else {
  console.log('❌ evaluateProgress method does not use internalConversation');
}

// Check if internalConversation is used in synthesizeFinalAnswer (should already be there)
const synthesizeMatch = content.match(/synthesizeFinalAnswer[\s\S]*?formatInternalConversation/);
if (synthesizeMatch) {
  console.log('✅ synthesizeFinalAnswer method uses internalConversation');
} else {
  console.log('❌ synthesizeFinalAnswer method does not use internalConversation');
}

console.log('\nInternal conversation context verification complete!');
