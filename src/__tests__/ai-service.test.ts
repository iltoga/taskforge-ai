import { AIService } from '@/services/ai-service';
import { CalendarEvent } from '@/types/calendar';

// Mock Vercel AI SDK
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
  tool: jest.fn(),
}));

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const mockCreateOpenAI = jest.mocked(createOpenAI);
const mockGenerateText = jest.mocked(generateText);

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    // Mock the createOpenAI function to return a mock client
    mockCreateOpenAI.mockReturnValue({
      languageModel: jest.fn().mockReturnValue('mock-model'),
    } as any);

    jest.clearAllMocks();
    aiService = new AIService('test-api-key');
  });

  describe('processMessage', () => {
    it('should parse a create event request correctly', async () => {
      // Arrange
      const userMessage = 'Create a meeting with John tomorrow at 2 PM about project review';
      const mockResponse = {
        text: JSON.stringify({
          type: 'create',
          event: {
            summary: 'Meeting with John - Project Review',
            description: 'Project review meeting',
            start: { dateTime: '2024-06-16T14:00:00+08:00' },
            end: { dateTime: '2024-06-16T15:00:00+08:00' }
          }
        })
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.processMessage(userMessage);

      // Assert
      expect(result.type).toBe('create');
      expect(result.event?.summary).toBe('Meeting with John - Project Review');
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Calendar Assistant')
            }),
            expect.objectContaining({
              role: 'user',
              content: userMessage
            })
          ])
        })
      );
    });

    it('should parse a list events request correctly', async () => {
      // Arrange
      const userMessage = 'Show me my events for next week';
      const mockResponse = {
        text: JSON.stringify({
          type: 'list',
          timeRange: {
            start: '2024-06-17T00:00:00+08:00',
            end: '2024-06-23T23:59:59+08:00'
          }
        })
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.processMessage(userMessage);

      // Assert
      expect(result.type).toBe('list');
      expect(result.timeRange).toBeDefined();
      expect(result.timeRange?.start).toBe('2024-06-17T00:00:00+08:00');
    });

    it('should handle daily work report creation', async () => {
      // Arrange
      const userMessage = 'Create daily report for TechCorp: worked on API integration, fixed bugs in payment system';
      const mockResponse = {
        text: JSON.stringify({
          type: 'create',
          event: {
            summary: 'daily report - TechCorp',
            description: '• Worked on API integration\n• Fixed bugs in payment system',
            start: { date: '2024-06-15' },
            end: { date: '2024-06-16' }
          }
        })
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.processMessage(userMessage);

      // Assert
      expect(result.type).toBe('create');
      expect(result.event?.summary).toBe('daily report - TechCorp');
      expect(result.event?.description).toContain('API integration');
      expect(result.event?.start?.date).toBe('2024-06-15');
    });

    it('should handle update daily report request', async () => {
      // Arrange
      const userMessage = 'Update today\'s daily report: added code review session with team';
      const existingEvents: CalendarEvent[] = [
        {
          id: 'daily-report-1',
          summary: 'daily report - TechCorp',
          description: '• Worked on API integration\n• Fixed bugs in payment system',
          start: { date: '2024-06-15' },
          end: { date: '2024-06-16' }
        }
      ];

      const mockResponse = {
        text: JSON.stringify({
          type: 'update',
          eventId: 'daily-report-1',
          event: {
            description: '• Worked on API integration\n• Fixed bugs in payment system\n• Added code review session with team'
          }
        })
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.processMessage(userMessage, existingEvents);

      // Assert
      expect(result.type).toBe('update');
      expect(result.eventId).toBe('daily-report-1');
      expect(result.event?.description).toContain('code review session');
    });

    it('should handle errors in AI response gracefully', async () => {
      // Arrange
      const userMessage = 'Create a meeting';
      mockGenerateText.mockRejectedValue(new Error('OpenAI API Error'));

      // Act & Assert
      await expect(aiService.processMessage(userMessage)).rejects.toThrow('OpenAI API Error');
    });

    it('should handle invalid JSON response from AI', async () => {
      // Arrange
      const userMessage = 'Create a meeting';
      const mockResponse = {
        text: 'Invalid JSON response'
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(aiService.processMessage(userMessage)).rejects.toThrow();
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate a weekly work report correctly', async () => {
      // Arrange
      const events: CalendarEvent[] = [
        {
          id: '1',
          summary: 'daily report - TechCorp',
          description: '• API development\n• Bug fixes',
          start: { date: '2024-06-10' }
        },
        {
          id: '2',
          summary: 'daily report - TechCorp',
          description: '• Code review\n• Documentation',
          start: { date: '2024-06-11' }
        }
      ];

      const mockResponse = {
        text: `Stefano's Weekly WorkLog for TechCorp - June 10-16, 2024

**Monday, June 10:**
• API development
• Bug fixes

**Tuesday, June 11:**
• Code review
• Documentation

**Summary:**
This week focused primarily on API development and code quality improvements. Successfully completed bug fixes and enhanced documentation.`
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.generateWeeklyReport(events, 'TechCorp', '2024-06-10', '2024-06-16', 'gpt-4.1-mini-2025-04-14', 'Stefano');

      // Assert
      expect(result).toContain('Stefano\'s Weekly WorkLog for TechCorp');
      expect(result).toContain('API development');
      expect(result).toContain('Summary:');
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('weekly work report')
            })
          ])
        })
      );
    });
  });

  describe('translateToEnglish', () => {
    it('should translate non-English text to English', async () => {
      // Arrange
      const italianText = 'Riunione con il team di sviluppo domani alle 15:00';
      const mockResponse = {
        text: 'Meeting with the development team tomorrow at 3:00 PM'
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.translateToEnglish(italianText);

      // Assert
      expect(result).toBe('Meeting with the development team tomorrow at 3:00 PM');
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Translate')
            })
          ])
        })
      );
    });

    it('should return English text unchanged', async () => {
      // Arrange
      const englishText = 'Meeting with the team tomorrow at 3 PM';
      const mockResponse = {
        text: englishText
      } as any;

      mockGenerateText.mockResolvedValue(mockResponse);

      // Act
      const result = await aiService.translateToEnglish(englishText);

      // Assert
      expect(result).toBe(englishText);
    });
  });
});
