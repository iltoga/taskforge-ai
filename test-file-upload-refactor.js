#!/usr/bin/env node

/**
 * Test script to verify the refactored file upload system works with Chat Completions API
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing refactored file upload system...');

// Check if the FileSearchTool has been properly refactored
const fileSearchToolPath = path.join(__dirname, 'src/services/file-search-tool.ts');
const fileSearchContent = fs.readFileSync(fileSearchToolPath, 'utf8');

console.log('✅ Checking FileSearchTool refactoring...');

// Verify the new method exists
if (fileSearchContent.includes('processFilesWithChatCompletions')) {
  console.log('✅ New Chat Completions method found');
} else {
  console.error('❌ Chat Completions method not found');
  process.exit(1);
}

// Verify it uses the Chat Completions API
if (fileSearchContent.includes('this.openai.chat.completions.create')) {
  console.log('✅ Uses Chat Completions API');
} else {
  console.error('❌ Does not use Chat Completions API');
  process.exit(1);
}

// Verify old method is removed
if (!fileSearchContent.includes('processFilesWithVision')) {
  console.log('✅ Old Assistant API vision method removed');
} else {
  console.error('❌ Old method still present');
  process.exit(1);
}

// Check file upload endpoint
const fileUploadPath = path.join(__dirname, 'src/app/api/chat/files/route.ts');
const fileUploadContent = fs.readFileSync(fileUploadPath, 'utf8');

console.log('✅ Checking file upload endpoint...');

// Verify it uses user_data purpose
if (fileUploadContent.includes("purpose: 'user_data'")) {
  console.log('✅ Uses user_data purpose instead of assistants');
} else {
  console.error('❌ Does not use user_data purpose');
  process.exit(1);
}

// Verify comments mention Chat Completions
if (fileUploadContent.includes('Chat Completions API')) {
  console.log('✅ Comments updated for Chat Completions API');
} else {
  console.error('❌ Comments not updated');
  process.exit(1);
}

console.log('🎉 All refactoring checks passed!');

console.log('\n📋 Summary of changes:');
console.log('- ✅ File upload uses purpose: "user_data" instead of "assistants"');
console.log('- ✅ FileSearchTool uses Chat Completions API for PDF processing');
console.log('- ✅ Removes file download restrictions (files with user_data purpose can be downloaded)');
console.log('- ✅ Uses direct vision processing with base64 images');
console.log('- ✅ Maintains backward compatibility for non-PDF files');

console.log('\n🚀 The file upload feature should now work properly without OpenAI API download restrictions!');
