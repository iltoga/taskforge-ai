import { CalendarService } from "../services/calendar-service";
import { ToolOrchestrator } from "../services/orchestrator/core";
import { CalendarTools } from "../tools/calendar-tools";
import { createToolRegistry } from "../tools/tool-registry";

// Mock the calendar service
jest.mock("../services/calendar-service");
const mockCalendarService = CalendarService as jest.MockedClass<
  typeof CalendarService
>;

describe("Orchestrator V2 - Synthesis Tool Usage", () => {
  let orchestrator: ToolOrchestrator;
  let calendarTools: CalendarTools;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock calendar service instance
    const mockInstance = {
      getEvents: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
    } as unknown as CalendarService;

    mockCalendarService.mockImplementation(() => mockInstance);
    calendarTools = new CalendarTools(mockInstance);
    orchestrator = new ToolOrchestrator("test-api-key");
  });

  test("should use synthesizeFinalAnswer tool for final synthesis", async () => {
    // Mock calendar service response
    const mockCalendarInstance = calendarTools[
      "calendarService"
    ] as jest.Mocked<CalendarService>;
    (mockCalendarInstance.getEvents as jest.Mock).mockResolvedValue({
      items: [
        {
          id: "1",
          summary: "Test Event",
          start: { dateTime: "2025-01-15T10:00:00Z" },
          end: { dateTime: "2025-01-15T11:00:00Z" },
          status: "confirmed" as const,
        },
      ],
    });

    const registry = createToolRegistry(calendarTools);

    // Mock the synthesis tool to track if it gets called
    const originalExecuteTool = registry.executeTool.bind(registry);
    const executeToolSpy = jest.fn().mockImplementation(originalExecuteTool);
    (registry as any).executeTool = executeToolSpy;

    // Simple user request that should trigger calendar tool and then synthesis
    const result = await orchestrator.orchestrate(
      "Show me my events",
      [],
      registry,
      "gpt-5-mini",
      { maxSteps: 5, maxToolCalls: 3 }
    );

    // Verify that synthesis tool was called
    const synthesisToolCalls = executeToolSpy.mock.calls.filter(
      ([toolName]) => toolName === "synthesizeFinalAnswer"
    );

    expect(synthesisToolCalls).toHaveLength(1);
    expect(synthesisToolCalls[0][0]).toBe("synthesizeFinalAnswer");

    // Verify synthesis parameters include all required fields
    const synthesisParams = synthesisToolCalls[0][1];
    expect(synthesisParams).toHaveProperty("userMessage", "Show me my events");
    expect(synthesisParams).toHaveProperty("chatHistory");
    expect(synthesisParams).toHaveProperty("toolCalls");
    expect(synthesisParams).toHaveProperty("previousSteps");
    expect(synthesisParams).toHaveProperty("model");
    expect(synthesisParams).toHaveProperty("stepId");
    expect(synthesisParams).toHaveProperty("aiConfig");

    // Verify that the final answer comes from the synthesis tool
    expect(result.success).toBe(true);
    expect(result.finalAnswer).toBeDefined();
    expect(typeof result.finalAnswer).toBe("string");
  });

  test("should not call synthesis tools during regular tool execution", async () => {
    const registry = createToolRegistry(calendarTools);

    // Mock the registry to track all tool calls
    const executeToolSpy = jest.fn();
    const originalExecuteTool = registry.executeTool.bind(registry);

    executeToolSpy.mockImplementation(async (toolName, params) => {
      if (
        toolName === "synthesizeFinalAnswer" ||
        toolName === "synthesizeChat"
      ) {
        // If synthesis tools are called during regular execution, return mock data
        return {
          success: true,
          data: {
            content: "Mock synthesis response",
            reasoning: "Mock reasoning",
          },
        };
      }
      return originalExecuteTool(toolName, params);
    });

    (registry as any).executeTool = executeToolSpy;

    await orchestrator.orchestrate(
      "Show me events",
      [],
      registry,
      "gpt-5-mini",
      { maxSteps: 3, maxToolCalls: 2 }
    );

    // Get all non-synthesis tool calls (regular execution phase)
    const regularToolCalls = executeToolSpy.mock.calls.filter(
      ([toolName]) =>
        toolName !== "synthesizeFinalAnswer" && toolName !== "synthesizeChat"
    );

    // Get synthesis tool calls (should only be at the end)
    const synthesisToolCalls = executeToolSpy.mock.calls.filter(
      ([toolName]) =>
        toolName === "synthesizeFinalAnswer" || toolName === "synthesizeChat"
    );

    // Verify synthesis tools are only called at the end, not during regular execution
    expect(synthesisToolCalls.length).toBeGreaterThan(0);
    expect(synthesisToolCalls.length).toBeLessThanOrEqual(2); // Max 1 initial + 1 refinement

    // If there were regular tool calls, they should all come before synthesis calls
    if (regularToolCalls.length > 0 && synthesisToolCalls.length > 0) {
      // Find the last regular call index (manual implementation since findLastIndex isn't available)
      let lastRegularCallIndex = -1;
      for (let i = executeToolSpy.mock.calls.length - 1; i >= 0; i--) {
        const [toolName] = executeToolSpy.mock.calls[i];
        if (
          toolName !== "synthesizeFinalAnswer" &&
          toolName !== "synthesizeChat"
        ) {
          lastRegularCallIndex = i;
          break;
        }
      }

      const firstSynthesisCallIndex = executeToolSpy.mock.calls.findIndex(
        ([toolName]) =>
          toolName === "synthesizeFinalAnswer" || toolName === "synthesizeChat"
      );

      expect(firstSynthesisCallIndex).toBeGreaterThan(lastRegularCallIndex);
    }
  });

  test("should only call synthesizeFinalAnswer once in normal flow", async () => {
    const registry = createToolRegistry(calendarTools);

    // Mock the synthesis tool to track calls
    const executeToolSpy = jest.fn();
    const originalExecuteTool = registry.executeTool.bind(registry);

    executeToolSpy.mockImplementation(async (toolName, params) => {
      if (toolName === "synthesizeFinalAnswer") {
        return {
          success: true,
          data: {
            content:
              "# Test Response\n\nThis is a properly formatted response.",
            reasoning: "Comprehensive synthesis",
          },
        };
      }
      return originalExecuteTool(toolName, params);
    });

    registry.executeTool = executeToolSpy;

    await orchestrator.orchestrate(
      "Simple test request",
      [],
      registry,
      "gpt-5-mini",
      { maxSteps: 5, maxToolCalls: 3 }
    );

    // Count synthesizeFinalAnswer calls
    const synthesisCount = executeToolSpy.mock.calls.filter(
      ([toolName]) => toolName === "synthesizeFinalAnswer"
    ).length;

    // Should be called exactly once in normal flow (without validation failures)
    expect(synthesisCount).toBe(1);
  });
});
