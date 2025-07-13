import { z } from "zod";
import { ToolOrchestrator } from "../services/orchestrator/core";
import { DefaultToolRegistry } from "../tools/tool-registry";
import { ChatHistory } from "../types/chat";

// Mock the external dependencies
jest.mock("../lib/openai", () => ({
  generateTextWithProvider: jest.fn(),
}));

describe("ToolOrchestrator - Final Synthesis", () => {
  let orchestrator: ToolOrchestrator;
  let mockRegistry: DefaultToolRegistry;

  beforeEach(() => {
    orchestrator = new ToolOrchestrator("test-api-key");
    mockRegistry = new DefaultToolRegistry();

    // Simple schema for testing
    const simpleSchema = z.object({});

    // Mock synthesizeFinalAnswer tool
    mockRegistry.registerTool(
      {
        name: "synthesizeFinalAnswer",
        description: "Final synthesis tool",
        parameters: simpleSchema,
        category: "synthesis",
      },
      async () => ({
        success: true,
        data: {
          content: "This is the final synthesized answer",
          reasoning: "Final synthesis completed",
        },
      })
    );

    // Mock synthesizeChat tool (should be allowed during orchestration)
    mockRegistry.registerTool(
      {
        name: "synthesizeChat",
        description: "Chat synthesis tool",
        parameters: simpleSchema,
        category: "synthesis",
      },
      async () => ({
        success: true,
        data: "Chat summary",
      })
    );

    // Mock a regular tool for testing
    mockRegistry.registerTool(
      {
        name: "testTool",
        description: "Test tool",
        parameters: simpleSchema,
        category: "test",
      },
      async () => ({
        success: true,
        data: "Test result",
      })
    );
  });

  test("should call synthesizeFinalAnswer exactly once as the final step", async () => {
    const mockGenerateText = require("../lib/openai").generateTextWithProvider;

    // Mock analysis response
    mockGenerateText
      .mockResolvedValueOnce({
        text: `REQUEST DECOMPOSITION: Simple test request
TOOL STRATEGY: Use testTool for basic functionality
INFORMATION REQUIREMENTS: None
APPROACH PLAN: Execute test tool
COMPLEXITY ASSESSMENT: Low complexity`,
      })
      // Mock planning response - should NOT include synthesizeFinalAnswer
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { goal: "test action", tool: "testTool", parameters: {} },
        ]),
      })
      // Mock progress evaluation - should say STOP
      .mockResolvedValueOnce({
        text: "STOP - Task completed successfully",
      })
      // Mock validation
      .mockResolvedValueOnce({
        text: "FORMAT_ACCEPTABLE - Response looks good",
      });

    const chatHistory: ChatHistory = [];

    const result = await orchestrator.orchestrate(
      "Simple test request",
      chatHistory,
      mockRegistry,
      "gpt-4",
      { maxSteps: 5, maxToolCalls: 3 }
    );

    expect(result.success).toBe(true);
    expect(result.finalAnswer).toBe("This is the final synthesized answer");

    // Verify synthesizeFinalAnswer was called exactly once
    const synthesisSteps =
      result.steps?.filter((s) => s.type === "synthesis") || [];
    expect(synthesisSteps).toHaveLength(1);
    expect(synthesisSteps[0].reasoning).toContain("Final synthesis");
  });

  test("synthesizeChat should be allowed during orchestration", () => {
    // Test that synthesizeChat is included in available tools for planning
    const availableTools = mockRegistry.getAvailableTools();
    const synthesizeChatTool = availableTools.find(
      (t) => t.name === "synthesizeChat"
    );
    const synthesizeFinalTool = availableTools.find(
      (t) => t.name === "synthesizeFinalAnswer"
    );

    expect(synthesizeChatTool).toBeDefined();
    expect(synthesizeFinalTool).toBeDefined();

    // Both tools should be in registry, but only synthesizeChat should be available for planning
    expect(mockRegistry.getToolDefinition("synthesizeChat")).toBeDefined();
    expect(
      mockRegistry.getToolDefinition("synthesizeFinalAnswer")
    ).toBeDefined();
  });

  test("should handle synthesizeFinalAnswer tool failure gracefully", async () => {
    // Override with failing implementation
    mockRegistry.registerTool(
      {
        name: "synthesizeFinalAnswer",
        description: "Final synthesis tool",
        parameters: z.object({}),
        category: "synthesis",
      },
      async () => ({
        success: false,
        error: "Synthesis failed",
      })
    );

    const mockGenerateText = require("../lib/openai").generateTextWithProvider;

    mockGenerateText
      .mockResolvedValueOnce({
        text: `REQUEST DECOMPOSITION: Simple test
TOOL STRATEGY: Basic test
INFORMATION REQUIREMENTS: None
APPROACH PLAN: Execute test
COMPLEXITY ASSESSMENT: Low`,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([
          { goal: "test action", tool: "testTool", parameters: {} },
        ]),
      })
      .mockResolvedValueOnce({
        text: "STOP - Task completed",
      })
      .mockResolvedValueOnce({
        text: "FORMAT_ACCEPTABLE",
      });

    const chatHistory: ChatHistory = [];

    const result = await orchestrator.orchestrate(
      "Simple test",
      chatHistory,
      mockRegistry,
      "gpt-4"
    );

    expect(result.success).toBe(true);
    // Should have fallback response when synthesis tool fails
    expect(result.finalAnswer).toContain("error while formatting");
  });
});
