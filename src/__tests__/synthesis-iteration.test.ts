/**
 * @jest-environment node
 */

/**
 * Test for the enhanced orchestrator synthesis iteration feature
 * This tests the new capability to detect and refine response format
 * to ensure holistic summaries vs detailed breakdowns match user intent
 */

import { generateTextWithProvider } from "../lib/openai";
import { CalendarService } from "../services/calendar-service";
import { ToolOrchestrator } from "../services/tool-orchestrator";
import { CalendarTools } from "../tools/calendar-tools";
import { createToolRegistry } from "../tools/tool-registry";

// Mock CalendarService
const mockCalendarService = {
  getEvents: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
} as unknown as jest.Mocked<CalendarService>;

// Mock OpenAI generateTextWithProvider
jest.mock("../lib/openai", () => ({
  generateTextWithProvider: jest.fn(),
  getProviderConfigByModel: jest.fn(() => ({
    provider: "openai",
    apiKey: "test-key",
  })),
}));

const mockGenerateTextWithProvider =
  generateTextWithProvider as jest.MockedFunction<
    typeof generateTextWithProvider
  >;

describe("Enhanced Orchestrator - Synthesis Iteration", () => {
  let orchestrator: ToolOrchestrator;
  let calendarTools: CalendarTools;

  beforeEach(() => {
    jest.clearAllMocks();
    calendarTools = new CalendarTools(mockCalendarService);
    orchestrator = new ToolOrchestrator("test-api-key");
    process.env.OPENAI_API_KEY = "test-key";
  });

  test("should iterate synthesis for holistic summary when initial response is too detailed", async () => {
    // Mock calendar data
    mockCalendarService.getEvents.mockResolvedValue({
      items: [
        {
          id: "1",
          summary: "TechcorpDaily Report",
          description: "Backend work on API endpoints",
          start: { date: "2025-03-15" },
          end: { date: "2025-03-16" },
          status: "confirmed" as const,
        },
        {
          id: "2",
          summary: "TechcorpClient Meeting",
          description: "Project review with client",
          start: { dateTime: "2025-04-10T14:00:00+08:00" },
          end: { dateTime: "2025-04-10T15:00:00+08:00" },
          status: "confirmed" as const,
        },
      ],
    });

    const registry = createToolRegistry(calendarTools);

    // Mock the orchestration sequence
    mockGenerateTextWithProvider
      // Analysis phase
      .mockResolvedValueOnce({
        text: `## 1. REQUEST DECOMPOSITION
User wants a high-level overview/summary of how the Techcorpproject is going, not a detailed event listing.
This is a HOLISTIC SUMMARY request based on keywords "how is" and "going".

## 5. COMPLEXITY ASSESSMENT
Moderate - need to gather events and synthesize insights about project status.`,
      })
      // Tool decision
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[
  {
    "name": "searchEvents",
    "parameters": {
      "query": "nespola",
      "timeRange": {
        "start": "2025-03-01T00:00:00+08:00",
        "end": "2025-06-30T23:59:59+08:00"
      }
    },
    "reasoning": "Search for techoneevents to understand project status and activities"
  }
]
\`\`\``,
      })
      // Progress evaluation
      .mockResolvedValueOnce({
        text: `\`\`\`
COMPLETE: Found 2 Techcorpevents that provide sufficient information to assess project status and provide holistic overview.
\`\`\``,
      })
      // Initial synthesis (too detailed - just lists events)
      .mockResolvedValueOnce({
        text: `## Events Summary for techone(March - June 2025)

### TechcorpDaily Report
**Date:** March 15, 2025
**Description:** Backend work on API endpoints
**Status:** Confirmed

### TechcorpClient Meeting
**Date:** April 10, 2025 at 2:00 PM - 3:00 PM
**Description:** Project review with client
**Status:** Confirmed

## Total Events
Found 2 events for techoneduring this period.`,
      })
      // Format validation (detects mismatch)
      .mockResolvedValueOnce({
        text: `\`\`\`
FORMAT_NEEDS_REFINEMENT: The user asked "how is the techcorpproject going" which is a HOLISTIC SUMMARY request, but the response provided a DETAILED BREAKDOWN of individual events instead of a synthesized project overview.

REQUIRED_CHANGES:
- Transform from event listing to integrated project narrative
- Provide overall project status and insights
- Synthesize patterns and progress indicators
- Use conversational, analytical tone rather than structured event list

EXPECTED_FORMAT: An integrated narrative about project status, progress, and key insights based on the calendar data, not individual event descriptions.
\`\`\``,
      })
      // Refined synthesis (proper holistic summary)
      .mockResolvedValueOnce({
        text: `## TechcorpProject Status Overview

Based on my review of your calendar data from March to June 2025, here's how the Techcorpproject is progressing:

**Current Status:**
The project appears to be in active development with regular activities. Over this 4-month period, I can see consistent engagement with both internal development work and client collaboration.

**Key Highlights:**
- **Development Focus**: There's been backend API development work in March, showing technical progress on core infrastructure
- **Client Engagement**: April included a project review meeting with the client, indicating good communication and milestone checkpoints
- **Consistent Activity**: The project maintains steady momentum with both development work and stakeholder meetings

**Overall Assessment:**
The Techcorpproject shows healthy progress with a good balance of technical development and client communication. The timeline suggests organized project management with regular development cycles and client touchpoints.

**Looking Ahead:**
The established pattern of development work followed by client reviews suggests a well-structured project approach that should continue to deliver steady progress.`,
      })
      // Final format validation (should accept this time)
      .mockResolvedValueOnce({
        text: `\`\`\`
FORMAT_ACCEPTABLE: The response properly addresses the user's request with appropriate format and content structure.
\`\`\``,
      });

    // Execute orchestration
    const result = await orchestrator.orchestrate(
      "how is the techcorpproject going between march and june 2025?",
      [], // empty chat history
      registry,
      "gpt-4.1-mini",
      {
        developmentMode: true,
        maxSteps: 15,
      }
    );

    // Verify successful orchestration
    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(1);

    // Verify synthesis iteration occurred
    // Should have: analysis, tool_decision, tool_call, evaluation, initial_synthesis, format_validation, refined_synthesis
    expect(result.steps.length).toBeGreaterThan(5);

    // Find synthesis steps
    const synthesisSteps = result.steps.filter(
      (step) => step.type === "synthesis"
    );
    expect(synthesisSteps.length).toBeGreaterThan(1); // Should have multiple synthesis attempts

    // Find validation steps
    const evaluationSteps = result.steps.filter(
      (step) => step.type === "evaluation"
    );
    expect(evaluationSteps.length).toBeGreaterThan(2); // Should have format validation in addition to progress evaluation

    // Verify final answer is holistic, not detailed breakdown
    expect(result.finalAnswer).toContain("Project Status Overview");
    expect(result.finalAnswer).toContain("Current Status:");
    expect(result.finalAnswer).toContain("Overall Assessment:");
    expect(result.finalAnswer).not.toMatch(/###.*Event/); // Should not have individual event headings

    // Verify the response addresses the "how is going" question holistically
    expect(result.finalAnswer).toContain("progressing");
    expect(result.finalAnswer).toContain("progress");
    expect(result.finalAnswer).toMatch(/active|healthy|steady/);

    console.log("✅ Synthesis iteration successfully:");
    console.log("  - Detected holistic summary request vs detailed breakdown");
    console.log("  - Validated initial response format against user intent");
    console.log("  - Refined synthesis to provide proper project overview");
    console.log("  - Generated integrated narrative instead of event listing");
  });

  test("should accept detailed breakdown on first attempt when appropriate", async () => {
    // Mock calendar data
    mockCalendarService.getEvents.mockResolvedValue({
      items: [
        {
          id: "1",
          summary: "TechcorpMeeting",
          start: { dateTime: "2025-03-15T14:00:00+08:00" },
          end: { dateTime: "2025-03-15T15:00:00+08:00" },
          status: "confirmed" as const,
        },
      ],
    });

    const registry = createToolRegistry(calendarTools);

    mockGenerateTextWithProvider
      // Analysis
      .mockResolvedValueOnce({
        text: `User wants specific event listings - DETAILED BREAKDOWN request based on keyword "list"`,
      })
      // Tool decision
      .mockResolvedValueOnce({
        text: `\`\`\`json
CALL_TOOLS:
[{"name": "searchEvents", "parameters": {"query": "nespola"}}]
\`\`\``,
      })
      // Progress evaluation
      .mockResolvedValueOnce({
        text: `COMPLETE: Found events to list`,
      })
      // Initial synthesis (detailed breakdown - appropriate for this request)
      .mockResolvedValueOnce({
        text: `## TechcorpEvents

### TechcorpMeeting
**Date:** March 15, 2025 at 2:00 PM - 3:00 PM
**Status:** Confirmed

**Total:** 1 event found.`,
      })
      // Format validation (accepts detailed format)
      .mockResolvedValueOnce({
        text: `\`\`\`
FORMAT_ACCEPTABLE: The response properly addresses the user's request with appropriate format and content structure.
\`\`\``,
      });

    const result = await orchestrator.orchestrate(
      "list all techcorpevents",
      [], // empty chat history
      registry,
      "gpt-4.1-mini",
      { developmentMode: true }
    );

    expect(result.success).toBe(true);

    // Should only have one synthesis step since format was acceptable
    const synthesisSteps = result.steps.filter(
      (step) => step.type === "synthesis"
    );
    expect(synthesisSteps).toHaveLength(1);

    // Should contain proper event breakdown format
    expect(result.finalAnswer).toContain("### TechcorpMeeting");
    expect(result.finalAnswer).toContain("**Date:**");

    console.log(
      "✅ Detailed breakdown accepted on first attempt when appropriate"
    );
  });
});
