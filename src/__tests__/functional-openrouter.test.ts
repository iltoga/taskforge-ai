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
    // Get OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    if (!openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY not found in environment variables. Make sure you have a .env file with OPENROUTER_API_KEY set."
      );
    }

    if (!openAiApiKey) {
      throw new Error(
        "OPENAI_API_KEY not found in environment variables. Make sure you have a .env file with OPENAI_API_KEY set."
      );
    }

    aiService = new AIService(openAiApiKey);
  });

  it("should correctly process a calendar request using Gemini model via OpenRouter", async () => {
    const userMessage =
      "create a meeting with John tomorrow at 2pm about project review";

    // Mock existing events
    const mockExistingEvents: CalendarEvent[] = [];

    console.log("Sending message to OpenRouter Gemini:", userMessage);
    console.log("Using model: google/gemini-2.0-flash-001");

    // Call the AI service with Gemini model
    const result = await aiService.processMessage(
      userMessage,
      mockExistingEvents,
      "google/gemini-2.0-flash-001"
    );

    console.log("Gemini Response:", JSON.stringify(result, null, 2));

    // Validate the AI correctly identified this as a create operation
    expect(result.type).toBe("create");

    // Validate the AI correctly parsed the event details
    expect(result.event).toBeDefined();
    expect(result.event?.summary).toContain("John");
    expect(result.event?.summary?.toLowerCase()).toContain("project review");

    // Validate date/time parsing
    expect(result.event?.start?.dateTime).toBeDefined();
    expect(result.event?.end?.dateTime).toBeDefined();

    console.log("✅ OpenRouter Gemini integration working correctly");
  }, 30000); // 30 second timeout for API call

  it("should handle translation using OpenRouter model", async () => {
    const italianMessage =
      "crea un incontro con Marco domani alle 15 per discutere del progetto";

    console.log(
      "Translating Italian message using OpenRouter:",
      italianMessage
    );

    // Test translation
    const translatedMessage = await aiService.translateToEnglish(
      italianMessage
    );

    console.log("Translated message:", translatedMessage);

    // Should translate to English
    expect(translatedMessage).toContain("Marco");
    expect(translatedMessage.toLowerCase()).toMatch(
      /meeting|appointment|event/
    );
    expect(translatedMessage.toLowerCase()).toMatch(/tomorrow|15|3/);

    console.log("✅ OpenRouter translation working correctly");
  }, 30000);

  it("should work with both OpenAI and OpenRouter models", async () => {
    const userMessage = "list my events for next week";
    const mockEvents: CalendarEvent[] = [];

    console.log("Testing both OpenAI and OpenRouter models...");

    // Test with OpenAI model
    const openAIResult = await aiService.processMessage(
      userMessage,
      mockEvents,
      "gpt-5-mini"
    );
    console.log("OpenAI result:", openAIResult.type);

    // Test with OpenRouter Gemini model
    const openRouterResult = await aiService.processMessage(
      userMessage,
      mockEvents,
      "google/gemini-2.0-flash-001"
    );
    console.log("OpenRouter result:", openRouterResult.type);

    // Both should recognize this as a list operation
    expect(openAIResult.type).toBe("list");
    expect(openRouterResult.type).toBe("list");

    console.log("✅ Both providers working correctly");
  }, 60000); // 60 second timeout for both API calls
});
