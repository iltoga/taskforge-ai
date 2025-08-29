/**
 * Test for orchestrator tool output injection and context management.
 *
 * This test verifies:
 * 1. Tool outputs are properly injected into conversation history
 * 2. Context building includes all previous tool outputs
 * 3. Logging captures what is passed to each tool
 * 4. Tool result formatting is standardized
 */

import { ToolOrchestrator } from "../services/orchestrator/core";
import * as utils from "../services/orchestrator/utils";
import { ToolRegistry, ToolResult } from "../tools/tool-registry";
import { ChatHistory } from "../types/chat";

// Mock dependencies
jest.mock("../lib/openai", () => ({
  generateTextWithProvider: jest.fn().mockResolvedValue({
    text: "COMPLETE: Task completed successfully",
  }),
}));

jest.mock("../tools/tool-registry");

describe("Orchestrator Tool Output Injection", () => {
  let orchestrator: ToolOrchestrator;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    orchestrator = new ToolOrchestrator("test-api-key");
    mockProgressCallback = jest.fn();
    orchestrator.setProgressCallback(mockProgressCallback);

    mockToolRegistry = {
      getAvailableTools: jest.fn().mockReturnValue([
        {
          name: "testTool",
          description: "A test tool",
          category: "test",
          parameters: {},
        },
      ]),
      getAvailableCategories: jest.fn().mockReturnValue(["test"]),
      getToolsByCategory: jest.fn().mockReturnValue([
        {
          name: "testTool",
          description: "A test tool",
          category: "test",
          parameters: {},
        },
      ]),
      executeTool: jest.fn(),
      getToolDefinition: jest.fn(),
      registerTool: jest.fn(),
    } as any;
  });

  describe("Tool Output Formatting", () => {
    it("should format successful tool results correctly", () => {
      const result: ToolResult = {
        success: true,
        data: { items: [{ id: 1, name: "Test Item" }] },
        message: "Tool executed successfully",
      };

      const formatted = utils.formatToolResultForChat("testTool", result, {
        param1: "value1",
      });

      expect(formatted).toContain("✅ Tool testTool completed successfully");
      expect(formatted).toContain('Parameters: {\n  "param1": "value1"\n}');
      expect(formatted).toContain(
        'Result: {\n  "items": [\n    {\n      "id": 1,\n      "name": "Test Item"\n    }\n  ]\n}'
      );
      expect(formatted).toContain("Message: Tool executed successfully");
    });

    it("should format failed tool results correctly", () => {
      const result: ToolResult = {
        success: false,
        error: "Tool execution failed",
        message: "Failed to process request",
      };

      const formatted = utils.formatToolResultForChat("testTool", result, {
        param1: "value1",
      });

      expect(formatted).toContain("❌ Tool testTool failed");
      expect(formatted).toContain('Parameters: {\n  "param1": "value1"\n}');
      expect(formatted).toContain("Error: Tool execution failed");
      expect(formatted).toContain("Message: Failed to process request");
    });

    it("should create concise execution summaries", () => {
      const execution = {
        tool: "testTool",
        parameters: { param1: "value1" },
        result: {
          success: true,
          data: { count: 5 },
          message: "Found 5 items",
        },
        startTime: 1000,
        endTime: 1100,
        duration: 100,
      };

      const summary = utils.createToolExecutionSummary(execution);

      expect(summary).toBe("testTool succeeded (100ms): Found 5 items");
    });
  });

  describe("Context Injection Logic", () => {
    it("should determine when to inject tool results", () => {
      const conversation = [
        { role: "user" as const, content: "Test message" },
        { role: "assistant" as const, content: "I'll help you with that" },
      ];

      const result: ToolResult = {
        success: true,
        data: { items: [] },
        message: "No items found",
      };

      const shouldInject = utils.shouldInjectToolResult(
        "testTool",
        result,
        conversation
      );
      expect(shouldInject).toBe(true);
    });

    it("should not inject if tool was already mentioned recently", () => {
      const conversation = [
        { role: "user" as const, content: "Test message" },
        { role: "assistant" as const, content: "Tool testTool succeeded" },
      ];

      const result: ToolResult = {
        success: true,
        data: { items: [] },
        message: "No items found",
      };

      const shouldInject = utils.shouldInjectToolResult(
        "testTool",
        result,
        conversation
      );
      expect(shouldInject).toBe(false);
    });

    it("should always inject synthesis tool results", () => {
      const conversation = [
        {
          role: "assistant" as const,
          content: "Tool synthesizeChat succeeded",
        },
      ];

      const result: ToolResult = {
        success: true,
        data: { content: "Synthesized response" },
      };

      const shouldInject = utils.shouldInjectToolResult(
        "synthesizeChat",
        result,
        conversation
      );
      expect(shouldInject).toBe(true);
    });
  });

  describe("Enhanced Context Building", () => {
    it("should build enhanced context with tool executions", () => {
      const userMessage = "Find my calendar events";
      const toolCalls = [
        {
          tool: "getEvents",
          parameters: { timeRange: { start: "2024-01-01" } },
          result: {
            success: true,
            data: [{ id: 1, title: "Meeting" }],
            message: "Found 1 event",
          },
          startTime: 1000,
          endTime: 1100,
          duration: 100,
        },
      ];
      const chatHistory: ChatHistory = [
        {
          id: "1",
          type: "user",
          content: "Previous message",
          timestamp: Date.now() - 10000,
        },
      ];

      const context = utils.buildEnhancedContext(
        userMessage,
        toolCalls,
        chatHistory
      );

      expect(context).toContain("USER REQUEST:\nFind my calendar events");
      expect(context).toContain("CHAT HISTORY:");
      expect(context).toContain("TOOL EXECUTIONS:");
      expect(context).toContain("✅ Tool getEvents completed successfully");
      expect(context).toContain("TOOL EXECUTION SUMMARY:");
      expect(context).toContain("getEvents succeeded (100ms): Found 1 event");
    });

    it("should handle empty tool calls gracefully", () => {
      const userMessage = "Test message";
      const toolCalls: any[] = [];
      const chatHistory: ChatHistory = [];

      const context = utils.buildEnhancedContext(
        userMessage,
        toolCalls,
        chatHistory
      );

      expect(context).toContain("USER REQUEST:\nTest message");
      expect(context).not.toContain("TOOL EXECUTIONS:");
      expect(context).not.toContain("TOOL EXECUTION SUMMARY:");
    });
  });

  describe("Integration with Orchestrator", () => {
    beforeEach(() => {
      // Mock the analysis and synthesis tools
      mockToolRegistry.executeTool.mockImplementation(async (name: string) => {
        if (name === "synthesizeFinalAnswer") {
          return {
            success: true,
            data: {
              content: "Final synthesized answer",
              reasoning: "Based on tool outputs",
            },
          };
        }

        return {
          success: true,
          data: { result: "test data" },
          message: `${name} executed successfully`,
        };
      });
    });

    it("should log tool parameters and context information", async () => {
      const userMessage = "Test orchestration";
      const chatHistory: ChatHistory = [];

      await orchestrator.orchestrate(
        userMessage,
        chatHistory,
        mockToolRegistry,
        "gpt-5-mini",
        { maxSteps: 2, maxToolCalls: 1, developmentMode: true }
      );

      // Check that progress callback was called with parameter logging
      const progressCalls = mockProgressCallback.mock.calls.map(
        (call) => call[0]
      );

      // Should log what is passed to tools
      expect(
        progressCalls.some(
          (call) =>
            call.includes("with parameters:") ||
            call.includes("Current context length:")
        )
      ).toBe(true);

      // Should log tool output injection decisions
      expect(
        progressCalls.some(
          (call) =>
            call.includes("Injected tool output") ||
            call.includes("Used simplified tool result")
        )
      ).toBe(true);

      // Should log context updates
      expect(
        progressCalls.some(
          (call) =>
            call.includes("Updated context with") &&
            call.includes("tool executions")
        )
      ).toBe(true);
    });
  });
});
