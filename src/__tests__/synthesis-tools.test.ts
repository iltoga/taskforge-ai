import {
  generateTextWithProvider,
  type AIProviderConfig,
  type GenerateTextResult,
  type ProviderType,
} from "../lib/openai";
import { SynthesisTools } from "../tools/synthesis-tools";

// Mock the OpenAI library
jest.mock("../lib/openai", () => ({
  generateTextWithProvider: jest.fn(),
}));

const mockGenerateTextWithProvider =
  generateTextWithProvider as jest.MockedFunction<
    typeof generateTextWithProvider
  >;

describe("SynthesisTools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("synthesizeFinalAnswer", () => {
    const mockToolCalls = [
      {
        tool: "getEvents",
        parameters: { timeRange: { start: "2024-01-01" } },
        result: {
          success: true,
          data: [
            {
              summary: "Test Event",
              start: { dateTime: "2024-01-01T10:00:00Z" },
            },
          ],
          message: "Found 1 event",
        },
        startTime: Date.now(),
        endTime: Date.now() + 100,
        duration: 100,
      },
    ];

    const mockPreviousSteps = [
      {
        id: "step_1",
        type: "analysis" as const,
        timestamp: Date.now(),
        content: "Analyzed user request for calendar events",
        reasoning: "Initial analysis step",
      },
    ];

    const mockChatHistory = [
      {
        id: "1",
        type: "user" as const,
        content: "Show me my events for today",
        timestamp: Date.now(),
      },
    ];

    const mockAIConfig: AIProviderConfig = {
      provider: "openai" as ProviderType,
      apiKey: "test-key",
    };

    it("should successfully synthesize a response with valid inputs", async () => {
      const mockResponse = {
        text: "## Events Summary\n\n### Test Event\n**Date:** January 1, 2024\n**Description:** Test Event",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Show me my events for today",
        chatHistory: mockChatHistory,
        toolCalls: mockToolCalls,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 5,
        aiConfig: mockAIConfig,
      });

      expect(result.content).toBe(mockResponse.text);
      expect(result.reasoning).toBe(
        "Comprehensive synthesis of all gathered information into a user-friendly response"
      );
      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.stringContaining("RESPONSE SYNTHESIS TASK"),
        mockAIConfig,
        expect.objectContaining({
          model: "gpt-5-mini",
          temperature: 0.3,
        })
      );
    });

    it("should handle empty tool calls array", async () => {
      const mockResponse = {
        text: "I couldn't find any relevant information for your request.",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Show me my events",
        chatHistory: mockChatHistory,
        toolCalls: [],
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 3,
        aiConfig: mockAIConfig,
      });

      expect(result.content).toBe(mockResponse.text);
      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.stringContaining("Available Data from Tools:\n"),
        mockAIConfig,
        expect.any(Object)
      );
    });

    it("should handle action requests with successful tool calls", async () => {
      const actionToolCalls = [
        {
          tool: "createEvent",
          parameters: { eventData: { summary: "New Meeting" } },
          result: {
            success: true,
            data: { id: "event123", summary: "New Meeting" },
            message: "Event created successfully",
          },
          startTime: Date.now(),
          endTime: Date.now() + 200,
          duration: 200,
        },
      ];

      const mockResponse = {
        text: "✅ Event 'New Meeting' has been successfully created.",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Create a meeting called New Meeting",
        chatHistory: mockChatHistory,
        toolCalls: actionToolCalls,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 4,
        aiConfig: mockAIConfig,
      });

      expect(result.content).toBe(mockResponse.text);
      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.stringContaining("✅ **createEvent** completed successfully"),
        mockAIConfig,
        expect.any(Object)
      );
    });

    it("should handle failed tool calls", async () => {
      const failedToolCalls = [
        {
          tool: "deleteEvent",
          parameters: { eventId: "nonexistent" },
          result: {
            success: false,
            error: "Event not found",
            message: "Failed to delete event",
          },
          startTime: Date.now(),
          endTime: Date.now() + 150,
          duration: 150,
        },
      ];

      const mockResponse = {
        text: "❌ I couldn't delete the event because it was not found.",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Delete the meeting",
        chatHistory: mockChatHistory,
        toolCalls: failedToolCalls,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 2,
        aiConfig: mockAIConfig,
      });

      expect(result.content).toBe(mockResponse.text);
      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.stringContaining("❌ **deleteEvent** failed"),
        mockAIConfig,
        expect.any(Object)
      );
    });

    it("should handle models that don't support temperature", async () => {
      const mockResponse = {
        text: "Response without temperature setting",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Test request",
        chatHistory: mockChatHistory,
        toolCalls: mockToolCalls,
        previousSteps: mockPreviousSteps,
        model: "o4-mini",
        stepId: 1,
        aiConfig: mockAIConfig,
      });

      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.any(String),
        mockAIConfig,
        expect.objectContaining({
          model: "o4-mini",
          images: undefined,
        })
      );

      // Should not include temperature for o4-mini
      const call = mockGenerateTextWithProvider.mock.calls[0];
      expect(call[2]).not.toHaveProperty("temperature");
    });

    it("should handle missing AI config by using default config", async () => {
      const mockResponse = {
        text: "Response with default config",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Test request",
        chatHistory: mockChatHistory,
        toolCalls: mockToolCalls,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 1,
        // aiConfig is optional, not provided
      });

      expect(result.content).toBe(mockResponse.text);
      expect(mockGenerateTextWithProvider).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          provider: "openai",
        }),
        expect.any(Object)
      );
    });

    it("should handle undefined response from AI provider", async () => {
      const mockResponse: GenerateTextResult = { text: "" };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      const result = await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Test request",
        chatHistory: mockChatHistory,
        toolCalls: mockToolCalls,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 1,
        aiConfig: mockAIConfig,
      });

      expect(result.content).toBe("No response text available");
      expect(result.reasoning).toBe(
        "Comprehensive synthesis of all gathered information into a user-friendly response"
      );
    });

    it("should include previous steps context when available", async () => {
      const multipleSteps = [
        {
          id: "step_1",
          type: "analysis" as const,
          timestamp: Date.now(),
          content:
            "This is a very long analysis step that should be truncated because it exceeds the 150 character limit and we want to keep the context concise",
          reasoning: "Analysis reasoning",
        },
        {
          id: "step_2",
          type: "tool_decision" as const,
          timestamp: Date.now(),
          content: "Short step",
          reasoning: "Tool decision reasoning",
        },
      ];

      const mockResponse = {
        text: "Response with steps context",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Test request",
        chatHistory: mockChatHistory,
        toolCalls: mockToolCalls,
        previousSteps: multipleSteps,
        model: "gpt-5-mini",
        stepId: 3,
        aiConfig: mockAIConfig,
      });

      const promptArg = mockGenerateTextWithProvider.mock.calls[0][0];
      expect(promptArg).toContain("Processing Steps Summary:");
      expect(promptArg).toContain("[step_1] ANALYSIS:");
      expect(promptArg).toContain("[step_2] TOOL_DECISION:");
      // Check that long content is truncated
      expect(promptArg).toContain(
        "This is a very long analysis step that should be truncated because it exceeds the 150 character limit and we want to keep the context..."
      );
    });

    it("should properly format tool results with object data", async () => {
      const toolCallsWithObjectData = [
        {
          tool: "getEvents",
          parameters: { query: "meeting" },
          result: {
            success: true,
            data: {
              events: [
                { id: "1", summary: "Meeting 1" },
                { id: "2", summary: "Meeting 2" },
              ],
              total: 2,
            },
            message: "Found events",
          },
          startTime: Date.now(),
          endTime: Date.now() + 300,
          duration: 300,
        },
      ];

      const mockResponse = {
        text: "Found 2 meetings",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Find my meetings",
        chatHistory: mockChatHistory,
        toolCalls: toolCallsWithObjectData,
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 1,
        aiConfig: mockAIConfig,
      });

      const promptArg = mockGenerateTextWithProvider.mock.calls[0][0];
      expect(promptArg).toContain(
        "✅ **getEvents** completed successfully (300ms)"
      );
      expect(promptArg).toContain('"events"');
      expect(promptArg).toContain('"total": 2');
      expect(promptArg).toContain("**Message:** Found events");
    });

    it("should detect action requests and log warnings appropriately", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const mockResponse = {
        text: "I couldn't complete the action",
      };
      mockGenerateTextWithProvider.mockResolvedValue(mockResponse);

      await SynthesisTools.synthesizeFinalAnswer({
        userMessage: "Create a new meeting for tomorrow",
        chatHistory: mockChatHistory,
        toolCalls: [], // No action tools called
        previousSteps: mockPreviousSteps,
        model: "gpt-5-mini",
        stepId: 1,
        aiConfig: mockAIConfig,
      });

      // The action detection and warning should be handled in the prompt logic
      const promptArg = mockGenerateTextWithProvider.mock.calls[0][0];
      expect(promptArg).toContain("CRITICAL RULE FOR CALENDAR ASSISTANT");
      expect(promptArg).toContain(
        "NEVER CLAIM ACTIONS WERE COMPLETED UNLESS TOOLS WERE ACTUALLY CALLED AND SUCCEEDED"
      );

      consoleSpy.mockRestore();
    });
  });
});
