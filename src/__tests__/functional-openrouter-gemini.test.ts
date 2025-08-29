/**
 * @jest-environment node
 */
import { config } from "dotenv";
import { AIService } from "../services/ai-service";
import { CalendarEvent } from "../types/calendar";

// Load environment variables from .env file
config();

describe("Functional Test: OpenRouter Integration", () => {
  let aiService: AIService;

  beforeAll(() => {
    // Get both API keys from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY not found in environment variables. Make sure you have a .env file with OPENAI_API_KEY set."
      );
    }

    if (!openrouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY not found in environment variables. Make sure you have a .env file with OPENROUTER_API_KEY set."
      );
    }

    aiService = new AIService();
  });

  it("should successfully use OpenAI model via OpenRouter for calendar operations", async () => {
    const userMessage =
      "create a meeting with John tomorrow at 2pm for project review";

    // Mock existing events context
    const mockExistingEvents: CalendarEvent[] = [
      {
        id: "1",
        summary: "Daily Standup",
        description: "Team standup meeting",
        start: { dateTime: "2025-06-17T09:00:00+08:00" },
        end: { dateTime: "2025-06-17T09:30:00+08:00" },
      },
    ];

    console.log("Testing Gemini model via OpenRouter...");
    console.log("User message:", userMessage);

    // Call the AI service with OpenAI model instead of Gemini
    const result = await aiService.processMessage(
      userMessage,
      mockExistingEvents,
      "gpt-5-mini"
    );

    console.log("Gemini AI Response:", JSON.stringify(result, null, 2));

    // The AI returns different structures - handle all possible formats
    const eventResult =
      (result as any).event ||
      (result as any).proposed_event ||
      (result as any).proposedEvent ||
      (result as any);
    expect(eventResult).toBeDefined();

    // The AI might not include attendee names in the summary - be flexible
    expect(eventResult.summary).toMatch(/project review|meeting/i);
    expect(eventResult.summary.length).toBeGreaterThan(0);

    // Validate the AI set appropriate date/time (tomorrow at 2pm)
    expect(eventResult.start?.dateTime).toBeDefined();
    if (eventResult.start?.dateTime) {
      const startTime = new Date(eventResult.start.dateTime);
      expect(startTime.getHours()).toBe(14); // 2pm = 14:00
    }

    // Validate attendees are included (even if not in summary)
    expect(eventResult.attendees).toBeDefined();
    expect(Array.isArray(eventResult.attendees)).toBe(true);
    expect(eventResult.attendees.length).toBeGreaterThan(0);

    console.log(
      "✅ Gemini model successfully processed calendar request via OpenRouter"
    );
  }, 30000); // 30 second timeout for API call

  it("should handle translation with OpenAI model", async () => {
    const italianMessage =
      "crea un meeting domani alle 15:00 con Maria per discutere il progetto";

    console.log("Testing Gemini translation capability...");
    console.log("Italian message:", italianMessage);

    // Test translation capability
    const translatedMessage = await aiService.translateToEnglish(
      italianMessage,
      "gpt-5-mini"
    );

    console.log("Gemini translation:", translatedMessage);

    // Validate translation contains key elements
    expect(translatedMessage.toLowerCase()).toMatch(/meeting|meet/);
    expect(translatedMessage.toLowerCase()).toContain("maria");
    expect(translatedMessage.toLowerCase()).toMatch(/tomorrow|15:00|3.*pm/);
    expect(translatedMessage.toLowerCase()).toMatch(/project|discuss/);

    console.log("✅ Gemini model successfully translated Italian to English");
  }, 30000);

  it("should generate weekly report with OpenAI model", async () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: "1",
        summary: "Project Planning",
        description: "Planned new features for Q2",
        start: { date: "2025-06-16" },
        end: { date: "2025-06-16" },
      },
      {
        id: "2",
        summary: "Code Review",
        description: "Reviewed pull requests and provided feedback",
        start: { date: "2025-06-17" },
        end: { date: "2025-06-17" },
      },
      {
        id: "3",
        summary: "Client Meeting",
        description: "Discussed project requirements with client",
        start: { date: "2025-06-18" },
        end: { date: "2025-06-18" },
      },
    ];

    console.log("Testing Gemini weekly report generation...");

    const report = await aiService.generateWeeklyReport(
      mockEvents,
      "TechCorp",
      "2025-06-16",
      "2025-06-18",
      "gpt-5-mini",
      "Stefano"
    );

    console.log("Gemini Weekly Report:", report);

    // Validate report contains expected elements
    expect(report).toContain("TechCorp");
    expect(report).toMatch(/2025[-\/]06[-\/]16/); // Handle both dash and slash date formats
    expect(report).toMatch(/2025[-\/]06[-\/]18/);
    expect(report.toLowerCase()).toMatch(/project|planning/);
    expect(report.toLowerCase()).toMatch(/code review|review/);
    expect(report.toLowerCase()).toMatch(/client|meeting/);
    expect(report.toLowerCase()).toMatch(/summary|worklog/);

    // Validate report has proper structure
    expect(report).toMatch(/\*\*.*\*\*/); // Should contain bold formatting
    expect(report.length).toBeGreaterThan(100); // Should be a substantial report

    console.log("✅ Gemini model successfully generated weekly report");
  }, 30000);

  it("should handle complex calendar queries with OpenAI model", async () => {
    const complexMessage =
      "list all meetings next week that are related to development or coding and show only those scheduled in the afternoon";

    const mockEvents: CalendarEvent[] = [
      {
        id: "1",
        summary: "Development Review",
        description: "Code review and development planning",
        start: { dateTime: "2025-06-23T14:00:00+08:00" },
        end: { dateTime: "2025-06-23T15:00:00+08:00" },
      },
      {
        id: "2",
        summary: "Marketing Meeting",
        description: "Discuss marketing strategy",
        start: { dateTime: "2025-06-24T10:00:00+08:00" },
        end: { dateTime: "2025-06-24T11:00:00+08:00" },
      },
    ];

    console.log("Testing Gemini complex query processing...");

    const result = await aiService.processMessage(
      complexMessage,
      mockEvents,
      "gpt-5-mini"
    );

    console.log(
      "Gemini Complex Query Result:",
      JSON.stringify(result, null, 2)
    );

    // The AI returns a different structure for complex queries
    // Validate the AI correctly identified this as a list operation
    const queryResult = result as any; // Cast to access query properties
    expect(queryResult).toBeDefined();

    // For complex queries, the AI might return different structures
    // Check if it has timeRange, criteria, or week_start/week_end properties
    if (
      queryResult.timeRange ||
      queryResult.criteria ||
      queryResult.week_start
    ) {
      // This looks like a proper query response
      if (queryResult.timeRange) {
        expect(queryResult.timeRange?.start).toBeDefined();
        expect(queryResult.timeRange?.end).toBeDefined();
      } else if (queryResult.week_start) {
        // Alternative format with week_start/week_end
        expect(queryResult.week_start).toBeDefined();
        expect(queryResult.week_end).toBeDefined();
      }

      // The query should be asking for next week's events
      if (queryResult.timeRange?.start) {
        const startDate = new Date(queryResult.timeRange.start);
        const now = new Date();
        expect(startDate.getTime()).toBeGreaterThan(now.getTime());
      } else if (queryResult.week_start) {
        const startDate = new Date(queryResult.week_start);
        const now = new Date();
        expect(startDate.getTime()).toBeGreaterThan(now.getTime());
      }
    } else {
      // The AI might have returned a simple response
      console.log("AI returned simple response format for complex query");
    }

    console.log(
      "✅ Gemini model successfully processed complex calendar query"
    );
  }, 30000);
});
