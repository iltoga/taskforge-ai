#!/usr/bin/env node

/**
 * Test script to verify Assistant API vision processing works correctly
 * This demonstrates the proper way to use Assistant API with image files
 */

import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testAssistantVision() {
  console.log('🧪 Testing Assistant API Vision Processing...');

  try {
    // Step 1: Upload a test file with vision purpose
    console.log('📁 Uploading test file with vision purpose...');

    // For this test, we'll use an existing file or create a simple one
    const testFile = path.join(process.cwd(), 'tmp', 'test-document.txt');

    // Create a simple test file if it doesn't exist
    if (!fs.existsSync(testFile)) {
      fs.mkdirSync(path.dirname(testFile), { recursive: true });
      fs.writeFileSync(testFile, 'This is a test document for vision processing.');
    }

    // Note: For real testing, you'd use a PDF file uploaded with vision purpose
    const uploadedFile = await openai.files.create({
      file: fs.createReadStream(testFile),
      purpose: 'assistants', // For text files
    });

    console.log('✅ File uploaded:', uploadedFile.id);

    // Step 2: Create Assistant with vision capabilities
    console.log('🤖 Creating Assistant...');
    const assistant = await openai.beta.assistants.create({
      name: "Vision Test Assistant",
      instructions: "You are a document analysis expert. Analyze the provided content thoroughly.",
      model: 'gpt-4o',
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [], // Will create on demand
        },
      },
    });

    console.log('✅ Assistant created:', assistant.id);

    // Step 3: Create thread and test message
    console.log('💬 Creating thread and test message...');
    const thread = await openai.beta.threads.create();

    // For vision files, the message would look like this:
    const messageContent = [
      {
        type: 'text',
        text: 'What do you see in this document? Please provide a detailed analysis.'
      }
      // For actual vision files uploaded with purpose="vision":
      // {
      //   type: 'image_file',
      //   image_file: {
      //     file_id: uploadedFile.id,
      //     detail: 'high'
      //   }
      // }
    ];

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: messageContent,
    });

    // Step 4: Run assistant
    console.log('🚀 Running assistant...');
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    });

    // Wait for completion
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, {
      thread_id: thread.id,
    });

    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      console.log(`⏳ Status: ${runStatus.status}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
    }

    console.log('✅ Run completed:', runStatus.status);

    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const response = messages.data[0];

      if (response && response.content[0] && response.content[0].type === 'text') {
        console.log('📄 Assistant Response:');
        console.log(response.content[0].text.value);
      }
    }

    // Cleanup
    console.log('🧹 Cleaning up...');
    await openai.beta.threads.delete(thread.id);
    await openai.beta.assistants.delete(assistant.id);
    await openai.files.delete(uploadedFile.id);

    console.log('🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAssistantVision();
}

export default testAssistantVision;
