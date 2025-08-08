/**
 * @jest-environment node
 */

/**
 * Quick test to verify the agentic mode routing fix
 */

import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route";

// Mock local auth module used by the route
jest.mock("@/lib/auth", () => ({
  __esModule: true,
  auth: jest.fn(),
  createGoogleAuth: jest.fn(),
}));

// Mock the auth module
jest.mock("@/lib/auth", () => ({
  authOptions: {},
  createGoogleAuth: jest.fn(),
}));

// Mock calendar service
jest.mock("@/services/calendar-service");

// Mock AI service
jest.mock("@/services/ai-service");

import { auth, createGoogleAuth } from "@/lib/auth";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCreateGoogleAuth = createGoogleAuth as jest.MockedFunction<
  typeof createGoogleAuth
>;
const MockedCalendarService = CalendarService as jest.MockedClass<
  typeof CalendarService
>;
const MockedAIService = AIService as jest.MockedClass<typeof AIService>;

describe("Agentic Mode Routing Fix", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated session
    (mockAuth as unknown as jest.Mock).mockResolvedValue({
      accessToken: "mock_access_token",
      user: { email: "test@example.com" },
    } as any);

    // Mock Google auth
    mockCreateGoogleAuth.mockReturnValue({} as any);

    // Set up environment variable
    process.env.OPENAI_API_KEY = "mock_openai_key";
  });

  test("should use agentic mode when developmentMode=true regardless of message content", async () => {
    // Mock the orchestrator to return a success response
    const mockProcessMessageWithOrchestrator = jest.fn().mockResolvedValue({
      success: true,
      response:
        "Found 2 Techcorpevents in March-June 2025: Meeting and Daily Report",
      steps: [],
      toolCalls: [],
    });

    MockedAIService.mockImplementation(
      () =>
        ({
          processMessageWithOrchestrator: mockProcessMessageWithOrchestrator,
          translateToEnglish: jest.fn().mockResolvedValue("test message"),
        } as any)
    );

    MockedCalendarService.mockImplementation(() => ({} as any));

    // Create request with agentic mode enabled (developmentMode=true)
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "summarize all events for techonebetween march and june 2025",
        model: "gpt-5-mini",
        useTools: true,
        orchestratorModel: "gpt-5-mini",
        developmentMode: true, // This should trigger agentic mode
      }),
    });

    // Call the API
    const response = await POST(request);
    const responseData = await response.json();

    // Verify that the orchestrator was called (agentic mode)
    expect(mockProcessMessageWithOrchestrator).toHaveBeenCalledWith(
      "test message", // translated message
      [], // chat history (empty for this test)
      expect.anything(), // tool registry
      "gpt-5-mini", // orchestrator model
      true, // development mode
      [] // fileIds (empty for this test)
    );

    // Verify response indicates agentic approach
    expect(responseData.approach).toBe("agentic");
    expect(responseData.success).toBe(true);
    expect(responseData.message).toContain("Techcorpevents");

    console.log("✅ FIXED: Agentic mode now works when developmentMode=true");
    console.log("   - Orchestrator was called with the correct parameters");
    console.log('   - Response approach is "agentic"');
    console.log('   - No longer requires "agentic" keyword in message');
  });

  test("should use simple tool mode when developmentMode=false", async () => {
    // Mock the simple tool processing
    const mockProcessMessageWithTools = jest.fn().mockResolvedValue({
      response: "Found some events",
      toolCalls: [],
    });

    MockedAIService.mockImplementation(
      () =>
        ({
          processMessageWithTools: mockProcessMessageWithTools,
          translateToEnglish: jest.fn().mockResolvedValue("test message"),
        } as any)
    );

    MockedCalendarService.mockImplementation(() => ({} as any));

    // Create request with agentic mode disabled (developmentMode=false)
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "summarize all events for techonebetween march and june 2025",
        model: "gpt-5-mini",
        useTools: true,
        orchestratorModel: "gpt-5-mini",
        developmentMode: false, // This should use simple tool mode
      }),
    });

    // Call the API
    const response = await POST(request);
    const responseData = await response.json();

    // Verify that simple tool processing was called
    expect(mockProcessMessageWithTools).toHaveBeenCalledWith(
      "test message", // translated message
      expect.anything() // calendar tools
    );

    // Verify response indicates tools approach
    expect(responseData.approach).toBe("tools");
    expect(responseData.success).toBe(true);

    console.log("✅ Simple tool mode still works when developmentMode=false");
  });
});
