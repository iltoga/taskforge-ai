import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { FileSearchTool } from '../../services/file-search-tool';

describe('FileSearchTool - Real OpenAI API Integration', () => {
  let openai: OpenAI;
  let fileSearchTool: FileSearchTool;
  let testFileId: string;
  const testFilePath = path.join(process.cwd(), 'tmp', 'Passport_new_ext_05_apr_2032.pdf');

  beforeAll(async () => {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for functional tests');
    }

    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    fileSearchTool = new FileSearchTool(process.env.OPENAI_API_KEY);

    // Check if test file exists
    if (!fs.existsSync(testFilePath)) {
      throw new Error(`Test file not found: ${testFilePath}`);
    }

    console.log('📁 Uploading test file for functional test...');

    // Upload the test file
    const fileBuffer = fs.readFileSync(testFilePath);
    const uploadedFile = await openai.files.create({
      file: new File([fileBuffer], 'Passport_new_ext_05_apr_2032.pdf', { type: 'application/pdf' }),
      purpose: 'assistants',
    });

    testFileId = uploadedFile.id;
    console.log(`✅ Test file uploaded with ID: ${testFileId}`);
    console.log(`📊 File details:`, {
      filename: uploadedFile.filename,
      bytes: uploadedFile.bytes,
      status: uploadedFile.status
    });

    // Wait a bit for file processing
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Clean up: delete the uploaded test file
    if (testFileId && openai) {
      try {
        await openai.files.delete(testFileId);
        console.log(`🧹 Cleaned up test file: ${testFileId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up test file: ${error}`);
      }
    }

    // Clean up file search tool resources
    if (fileSearchTool) {
      try {
        await fileSearchTool.cleanup();
        console.log('🧹 Cleaned up file search tool resources');
      } catch (error) {
        console.warn(`⚠️ Failed to clean up file search tool: ${error}`);
      }
    }
  }, 10000);

  describe('File Processing and Analysis', () => {
    it('should successfully upload and process a PDF file', async () => {
      expect(testFileId).toBeDefined();
      expect(testFileId).toMatch(/^file-/);

      // Verify file exists in OpenAI
      const fileInfo = await openai.files.retrieve(testFileId);
      expect(fileInfo.filename).toBe('Passport_new_ext_05_apr_2032.pdf');
      expect(fileInfo.bytes).toBeGreaterThan(0);
      expect(fileInfo.status).toBe('processed');
    });

    it('should initialize FileSearchTool with uploaded file', async () => {
      console.log('🚀 Testing FileSearchTool initialization...');

      await expect(
        fileSearchTool.initialize([testFileId], undefined, 'gpt-4.1-mini')
      ).resolves.not.toThrow();

      console.log('✅ FileSearchTool initialized successfully');
    }, 60000); // 60 second timeout

    it('should extract all data from passport file and summarize', async () => {
      console.log('🔍 Testing file content extraction...');

      const query = "extract all data from the file and summarize them";
      const results = await fileSearchTool.searchFiles(query);

      console.log('📊 Search results:', {
        resultsCount: results.length,
        hasResults: results.length > 0,
        firstResultPreview: results[0]?.content?.substring(0, 200)
      });

      // Verify we got results
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      const firstResult = results[0];
      expect(firstResult.content).toBeDefined();
      expect(firstResult.content.length).toBeGreaterThan(50); // Should have substantial content

      // Check for passport-specific content (adjust based on actual passport content)
      const content = firstResult.content.toLowerCase();

      // These are common elements that should appear in a passport analysis
      const passportIndicators = [
        'passport', 'document', 'travel', 'identity',
        'name', 'date', 'number', 'issued', 'expires'
      ];

      const foundIndicators = passportIndicators.filter(indicator =>
        content.includes(indicator)
      );

      console.log('🔍 Found passport indicators:', foundIndicators);

      // Should find at least some passport-related terms
      expect(foundIndicators.length).toBeGreaterThan(0);

      // Should NOT contain Tether-related content (this was the bug)
      expect(content).not.toContain('tether');
      expect(content).not.toContain('governance structure');
      expect(content).not.toContain('business model');

      console.log('✅ File content extraction successful and accurate');
    }, 90000); // 90 second timeout

    it('should handle different types of questions about the file', async () => {
      console.log('🔍 Testing various question types...');

      const testQueries = [
        "What type of document is this?",
        "What personal information can you see?",
        "What dates are mentioned in the document?",
        "Describe the structure and layout of this document"
      ];

      for (const query of testQueries) {
        console.log(`🔍 Testing query: "${query}"`);

        const results = await fileSearchTool.searchFiles(query);

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].content).toBeDefined();
        expect(results[0].content.length).toBeGreaterThan(20);

        console.log(`✅ Query "${query}" returned ${results[0].content.length} characters`);

        // Brief pause between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ All query types handled successfully');
    }, 120000); // 2 minute timeout

    it('should return relevant and specific content, not generic responses', async () => {
      console.log('🔍 Testing content specificity...');

      const results = await fileSearchTool.searchFiles("what you see in the uploaded file?");

      expect(results.length).toBeGreaterThan(0);
      const content = results[0].content.toLowerCase();

      // Should not contain generic or irrelevant responses
      const genericTerms = [
        'patient resources request',
        'form to request',
        'appears to be a form',
        'generic document',
        'template'
      ];

      for (const genericTerm of genericTerms) {
        expect(content).not.toContain(genericTerm);
      }

      // Should contain specific, detailed analysis
      expect(results[0].content.length).toBeGreaterThan(100);

      console.log('✅ Content is specific and relevant');
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle invalid file IDs gracefully', async () => {
      console.log('🔍 Testing error handling...');

      const invalidFileSearchTool = new FileSearchTool(process.env.OPENAI_API_KEY!);

      await expect(
        invalidFileSearchTool.initialize(['file-invalid123'], undefined, 'gpt-4.1-mini')
      ).rejects.toThrow();

      console.log('✅ Invalid file ID handled correctly');
    });

    it('should handle empty file list', async () => {
      const emptyFileSearchTool = new FileSearchTool(process.env.OPENAI_API_KEY!);

      // Should not throw for empty file list (early return)
      await expect(
        emptyFileSearchTool.initialize([], undefined, 'gpt-4.1-mini')
      ).resolves.not.toThrow();

      console.log('✅ Empty file list handled correctly');
    });
  });
});
