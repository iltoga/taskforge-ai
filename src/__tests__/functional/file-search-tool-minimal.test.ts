import OpenAI from 'openai';
import { FileSearchTool } from '../../services/file-search-tool';

describe('FileSearchTool - Minimal TDD Test', () => {
  let fileSearchTool: FileSearchTool;
  let openai: OpenAI;
  const testFileId = 'file-test-placeholder'; // We'll use an existing file

  beforeAll(() => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for functional tests');
    }

    fileSearchTool = new FileSearchTool(apiKey);
    openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  });

  afterAll(async () => {
    try {
      await fileSearchTool.cleanup();
    } catch (error) {
      console.warn('⚠️ Failed to cleanup file search tool:', error);
    }
  });

  it('should handle file validation correctly', async () => {
    console.log('🧪 Testing file validation logic...');

    // Test 1: Check that FileSearchTool constructor works
    expect(fileSearchTool).toBeDefined();

    // Test 2: Check that initialize with empty array returns early
    await fileSearchTool.initialize([]);
    console.log('✅ Empty file array handled correctly');

    // Test 3: List existing files to find a valid one for testing
    console.log('📋 Listing available files for testing...');
    const filesList = await openai.files.list({ purpose: 'assistants' });
    console.log(`📁 Found ${filesList.data.length} assistant files`);

    if (filesList.data.length > 0) {
      const testFile = filesList.data[0];
      console.log(`🔍 Using test file: ${testFile.id} (${testFile.filename})`);

      // Test 4: Initialize with a real file ID
      try {
        await fileSearchTool.initialize([testFile.id],
          "Extract all data from the uploaded file.",
          'gpt-4.1-mini'
        );
        console.log('✅ FileSearchTool initialized successfully with real file');

        // Test 5: Try a simple search
        const results = await fileSearchTool.searchFiles("What type of document is this?");

        expect(results).toBeDefined();
        console.log(`📊 Search returned ${results.length} results`);

        if (results.length > 0) {
          console.log(`✅ First result preview: ${results[0].content.substring(0, 100)}...`);
          expect(results[0].content.length).toBeGreaterThan(10);
        }

      } catch (error) {
        console.error('❌ Error during file search test:', error);
        throw error;
      }
    } else {
      console.log('⚠️ No assistant files found - skipping file search test');
    }

  }, 60000); // 1 minute timeout
});
