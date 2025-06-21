// Quick test to debug the progress message flow
const fs = require('fs');

// Check if the AI service is correctly structured
const aiServiceContent = fs.readFileSync('src/services/ai-service.ts', 'utf8');
console.log('🔍 Checking AI Service for progress message handling...');

const hasProgressInReturn = aiServiceContent.includes('progressMessages: result.progressMessages');
console.log('✅ AI Service returns progressMessages:', hasProgressInReturn);

const hasProgressArray = aiServiceContent.includes('const progressMessages: string[] = []');
console.log('✅ AI Service declares progressMessages array:', hasProgressArray);

const hasSetProgressCallback = aiServiceContent.includes('setProgressCallback');
console.log('✅ AI Service calls setProgressCallback:', hasSetProgressCallback);

// Check API route
const apiRouteContent = fs.readFileSync('src/app/api/chat/route.ts', 'utf8');
console.log('\n🔍 Checking API Route for progress message handling...');

const apiHasProgressInResponse = apiRouteContent.includes('progressMessages: result.progressMessages');
console.log('✅ API Route includes progressMessages in response:', apiHasProgressInResponse);

// Check Chat component
const chatContent = fs.readFileSync('src/components/Chat.tsx', 'utf8');
console.log('\n🔍 Checking Chat Component for progress message handling...');

const chatHasProgressState = chatContent.includes('currentProgressMessages');
console.log('✅ Chat Component has progress state:', chatHasProgressState);

const chatHasProgressDisplay = chatContent.includes('currentProgressMessages.length > 0');
console.log('✅ Chat Component displays progress messages:', chatHasProgressDisplay);

const chatHasProgressInResult = chatContent.includes('result.progressMessages');
console.log('✅ Chat Component reads progressMessages from result:', chatHasProgressInResult);

console.log('\n📋 Summary:');
console.log(`AI Service: ${hasProgressInReturn && hasProgressArray && hasSetProgressCallback ? '✅ GOOD' : '❌ ISSUES'}`);
console.log(`API Route: ${apiHasProgressInResponse ? '✅ GOOD' : '❌ ISSUES'}`);
console.log(`Chat Component: ${chatHasProgressState && chatHasProgressDisplay && chatHasProgressInResult ? '✅ GOOD' : '❌ ISSUES'}`);
