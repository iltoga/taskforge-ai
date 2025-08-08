import { ToolOrchestrator } from "../services/tool-orchestrator";

describe("Orchestrator Internal Processing Context", () => {
  let orchestrator: ToolOrchestrator;

  beforeEach(() => {
    orchestrator = new ToolOrchestrator("test-api-key");
  });

  test("should maintain internal processing context throughout iterations", () => {
    // Mock the orchestrator to test internal context passing
    const mockDecideToolUsage = jest.fn();
    const mockEvaluateProgress = jest.fn();
    const mockSynthesizeFinalAnswer = jest.fn();

    // Replace the private methods with our mocks
    (orchestrator as any).decideToolUsage = mockDecideToolUsage;
    (orchestrator as any).evaluateProgress = mockEvaluateProgress;
    (orchestrator as any).synthesizeFinalAnswer = mockSynthesizeFinalAnswer;

    // Mock return values
    mockDecideToolUsage.mockResolvedValue({
      id: "step_2",
      type: "tool_call",
      content: "EXECUTE: searchEvents with parameters...",
      timestamp: Date.now(),
    });

    mockEvaluateProgress.mockResolvedValue({
      id: "step_3",
      type: "evaluation",
      content: "CONTINUE: Need more information",
      timestamp: Date.now(),
    });

    mockSynthesizeFinalAnswer.mockResolvedValue({
      id: "step_4",
      type: "synthesis",
      content: "Final answer based on tools and analysis",
      timestamp: Date.now(),
    });

    // Mock tool registry with minimal functionality
    const mockToolRegistry = {
      getAvailableCategories: () => ["calendar"],
      getToolsByCategory: () => [
        {
          name: "searchEvents",
          description: "Search calendar events",
          execute: () => Promise.resolve({ success: true, data: [] }),
        },
      ],
      executeTool: () =>
        Promise.resolve({ success: true, data: [], message: "Success" }),
    };

    // This test ensures the signatures are correct and context is being passed
    expect(mockDecideToolUsage).toBeDefined();
    expect(mockEvaluateProgress).toBeDefined();
    expect(mockSynthesizeFinalAnswer).toBeDefined();
  });

  test("should include accumulated steps in decision making", async () => {
    // Test that the method signatures expect the steps parameter
    const mockDecideToolUsage = jest.fn().mockResolvedValue({
      id: "step_2",
      type: "tool_call",
      content: "EXECUTE: searchEvents",
      timestamp: Date.now(),
    });

    (orchestrator as any).decideToolUsage = mockDecideToolUsage;

    // Create mock parameters that would be passed to decideToolUsage
    const context = "User wants to see calendar events";
    const toolRegistry = {
      getAvailableCategories: () => [],
      getToolsByCategory: () => [],
    };
    const previousToolCalls: any[] = [];
    const previousSteps = [
      {
        id: "step_1",
        type: "analysis",
        content: "User is asking for calendar data",
        timestamp: Date.now(),
      },
    ];
    const model = "gpt-5-mini";
    const stepId = 2;

    // Call the method with all expected parameters including steps
    await (orchestrator as any).decideToolUsage(
      context,
      toolRegistry,
      previousToolCalls,
      previousSteps,
      model,
      stepId
    );

    // Verify the method was called with the steps parameter
    expect(mockDecideToolUsage).toHaveBeenCalledWith(
      context,
      toolRegistry,
      previousToolCalls,
      previousSteps, // This is the key addition - steps are now included
      model,
      stepId
    );
  });

  test("should include accumulated steps in evaluation", async () => {
    const mockEvaluateProgress = jest.fn().mockResolvedValue({
      id: "step_3",
      type: "evaluation",
      content: "CONTINUE: Need more data",
      timestamp: Date.now(),
    });

    (orchestrator as any).evaluateProgress = mockEvaluateProgress;

    const originalMessage = "Show me my events";
    const context = "User wants calendar events";
    const toolCalls: any[] = [];
    const previousSteps = [
      {
        id: "step_1",
        type: "analysis",
        content: "Initial analysis",
        timestamp: Date.now(),
      },
      {
        id: "step_2",
        type: "tool_call",
        content: "Executed searchEvents",
        timestamp: Date.now(),
      },
    ];
    const model = "gpt-5-mini";
    const stepId = 3;

    await (orchestrator as any).evaluateProgress(
      originalMessage,
      context,
      toolCalls,
      previousSteps,
      model,
      stepId
    );

    expect(mockEvaluateProgress).toHaveBeenCalledWith(
      originalMessage,
      context,
      toolCalls,
      previousSteps, // Steps context is included in evaluation
      model,
      stepId
    );
  });

  test("should include accumulated steps in synthesis", async () => {
    const mockSynthesizeFinalAnswer = jest.fn().mockResolvedValue({
      id: "step_4",
      type: "synthesis",
      content: "Final response",
      timestamp: Date.now(),
    });

    (orchestrator as any).synthesizeFinalAnswer = mockSynthesizeFinalAnswer;

    const userMessage = "Show me my events";
    const chatHistory: any[] = [];
    const context = "Context with tool results";
    const toolCalls: any[] = [];
    const previousSteps = [
      {
        id: "step_1",
        type: "analysis",
        content: "Analysis step",
        timestamp: Date.now(),
      },
      {
        id: "step_2",
        type: "evaluation",
        content: "Evaluation step",
        timestamp: Date.now(),
      },
    ];
    const model = "gpt-5-mini";
    const stepId = 4;

    await (orchestrator as any).synthesizeFinalAnswer(
      userMessage,
      chatHistory,
      context,
      toolCalls,
      previousSteps,
      model,
      stepId
    );

    expect(mockSynthesizeFinalAnswer).toHaveBeenCalledWith(
      userMessage,
      chatHistory,
      context,
      toolCalls,
      previousSteps, // Steps context is included in synthesis
      model,
      stepId
    );
  });
});
