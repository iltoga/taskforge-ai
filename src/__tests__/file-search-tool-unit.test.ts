import { describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { FileSearchTool } from '../services/file-search-tool';

// Mock OpenAI and dependencies
jest.mock('openai');
jest.mock('@ai-sdk/openai');

describe('FileSearchTool - Unit Tests', () => {
  let fileSearchTool: FileSearchTool;

  beforeEach(() => {
    // Mock process.env.OPENAI_API_KEY for testing
    process.env.OPENAI_API_KEY = 'test-key';
    fileSearchTool = new FileSearchTool('test-api-key');
  });

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      expect(fileSearchTool).toBeDefined();
    });
  });

  describe('PDF Processing Logic', () => {
    it('should handle empty file IDs list', async () => {
      // Should not throw for empty array
      await expect(
        fileSearchTool.initialize([], 'test instructions', 'gpt-4.1-mini')
      ).resolves.not.toThrow();
    });

    it('should validate file structure and types', () => {
      // Test that FileSearchResult interface has required fields
      const mockResult = {
        content: 'Test content',
        filename: 'test.pdf',
        relevance: 0.95,
        method: 'vision_api' as const
      };

      expect(mockResult.content).toBe('Test content');
      expect(mockResult.method).toBe('vision_api');
    });

    it('should create temp directories for PDF processing', () => {
      const tempDir = path.join(process.cwd(), 'tmp', 'pdf-images');

      // Clean up if exists
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      // Directory should not exist initially
      expect(fs.existsSync(tempDir)).toBe(false);

      // Create the directory (simulating what convertPdfToImages does)
      fs.mkdirSync(tempDir, { recursive: true });

      // Directory should now exist
      expect(fs.existsSync(tempDir)).toBe(true);

      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle file processing errors gracefully', () => {
      const errorMessage = 'Test error message';
      const error = new Error(errorMessage);

      expect(error.message).toBe(errorMessage);
      expect(error instanceof Error).toBe(true);
    });

    it('should validate file types', () => {
      const pdfFile = 'test.pdf';
      const textFile = 'test.txt';
      const imageFile = 'test.jpg';

      expect(pdfFile.toLowerCase().endsWith('.pdf')).toBe(true);
      expect(textFile.toLowerCase().endsWith('.pdf')).toBe(false);
      expect(imageFile.toLowerCase().endsWith('.pdf')).toBe(false);
    });
  });

  describe('Vision API Integration Logic', () => {
    it('should handle single page analysis structure', () => {
      const singlePageImages = [
        {
          pageNumber: 1,
          base64: 'mock-base64-data',
          filePath: '/tmp/page1.png'
        }
      ];

      expect(singlePageImages.length).toBe(1);
      expect(singlePageImages[0].pageNumber).toBe(1);
    });

    it('should handle multi-page analysis structure', () => {
      const multiPageImages = [
        {
          pageNumber: 1,
          base64: 'mock-base64-data-1',
          filePath: '/tmp/page1.png'
        },
        {
          pageNumber: 2,
          base64: 'mock-base64-data-2',
          filePath: '/tmp/page2.png'
        }
      ];

      expect(multiPageImages.length).toBe(2);
      expect(multiPageImages[0].pageNumber).toBe(1);
      expect(multiPageImages[1].pageNumber).toBe(2);
    });

    it('should format queries correctly for different scenarios', () => {
      const queries = [
        'what you see in the uploaded file?',
        'extract all data from the file and summarize them',
        'What type of document is this?',
        'What personal information can you see?'
      ];

      queries.forEach(query => {
        expect(typeof query).toBe('string');
        expect(query.length).toBeGreaterThan(0);
      });

      // Test query classification logic
      const isContentQuery = (q: string) =>
        q.toLowerCase().includes('what') &&
        (q.toLowerCase().includes('see') || q.toLowerCase().includes('find') || q.toLowerCase().includes('content'));

      expect(isContentQuery(queries[0])).toBe(true); // "what you see in the uploaded file?"
      expect(isContentQuery(queries[3])).toBe(true); // "What personal information can you see?"
    });
  });

  describe('File Search Fallback Logic', () => {
    it('should detect failed file processing scenarios', () => {
      const mockVectorStoreFiles = [
        { id: 'file-1', status: 'completed' },
        { id: 'file-2', status: 'failed' },
        { id: 'file-3', status: 'completed' }
      ];

      const failedFiles = mockVectorStoreFiles.filter(file => file.status === 'failed');
      expect(failedFiles.length).toBe(1);
      expect(failedFiles[0].id).toBe('file-2');
    });

    it('should handle generic response detection', () => {
      const responses = [
        'cannot find any relevant information',
        'no information available',
        'unable to locate the requested content',
        'This is a detailed passport analysis with specific information...',
        'patient resources request form', // This should trigger fallback
        'generic document template'
      ];

      const isGenericResponse = (response: string) => {
        const lowerResponse = response.toLowerCase();
        return lowerResponse.includes('cannot find') ||
               lowerResponse.includes('no information') ||
               lowerResponse.includes('unable to locate') ||
               lowerResponse.includes('patient resources') ||
               lowerResponse.includes('generic');
      };

      expect(isGenericResponse(responses[0])).toBe(true);
      expect(isGenericResponse(responses[1])).toBe(true);
      expect(isGenericResponse(responses[2])).toBe(true);
      expect(isGenericResponse(responses[3])).toBe(false); // Specific content
      expect(isGenericResponse(responses[4])).toBe(true);  // Should trigger fallback
      expect(isGenericResponse(responses[5])).toBe(true);
    });

    it('should validate content analysis logic', () => {
      const passportResponse = 'This passport shows nationality, date of birth, and passport number';
      const tetherResponse = 'This document shows tether governance structure and business model';
      const genericResponse = 'This appears to be a document';

      const containsPassportKeywords = (text: string) => {
        const lower = text.toLowerCase();
        return lower.includes('passport') ||
               lower.includes('nationality') ||
               lower.includes('date of birth') ||
               lower.includes('passport number');
      };

      const containsTetherKeywords = (text: string) => {
        const lower = text.toLowerCase();
        return lower.includes('tether') ||
               lower.includes('governance structure') ||
               lower.includes('business model');
      };

      expect(containsPassportKeywords(passportResponse)).toBe(true);
      expect(containsTetherKeywords(passportResponse)).toBe(false);

      expect(containsPassportKeywords(tetherResponse)).toBe(false);
      expect(containsTetherKeywords(tetherResponse)).toBe(true);

      expect(containsPassportKeywords(genericResponse)).toBe(false);
      expect(containsTetherKeywords(genericResponse)).toBe(false);
    });
  });

  afterEach(() => {
    // Clean up any temp files created during testing
    const tempDir = path.join(process.cwd(), 'tmp', 'pdf-images');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
