/**
 * @jest-environment node
 */

/**
 * Quick test to verify the agentic mode routing fix
 */

// Add global fetch polyfill for Node environment
import "whatwg-fetch";

// Mock Next.js Request/Response
Object.defineProperty(global, "Request", {
  value: class Request {
    constructor(public input: string, public init?: RequestInit) {}
    async json() {
      return JSON.parse((this.init?.body as string) || "{}");
    }
  },
});

Object.defineProperty(global, "Response", {
  value: class Response {
    constructor(public body?: any, public init?: ResponseInit) {}
    static json(data: any, init?: ResponseInit) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
    }
  },
});

import { POST } from "../app/api/chat/route";

// Mock local auth module used by the route
jest.mock("../../auth", () => ({
  __esModule: true,
  auth: jest.fn(),
  handlers: {},
  signIn: jest.fn(),
  signOut: jest.fn(),
  authConfig: {},
  createGoogleAuth: jest.fn(),
  isServiceAccountAvailable: jest.fn(),
}));

// Mock the auth module that the route actually imports from
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
  createGoogleAuth: jest.fn(),
  isServiceAccountAvailable: jest.fn(),
}));

// Mock calendar service
jest.mock("@/services/calendar-service");

// Mock AI service
jest.mock("@/services/ai-service");

import { auth, createGoogleAuth } from "@/lib/auth";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";

const mockAuth = auth as jest.MockedFunction<any>;
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
    mockAuth.mockResolvedValue({
      accessToken: "mock_access_token",
      user: { email: "test@example.com" },
    } as any);

    // Mock Google auth
    mockCreateGoogleAuth.mockReturnValue({} as any);

    // Set up environment variable
    process.env.OPENAI_API_KEY = "mock_openai_key";
    process.env.BYPASS_GOOGLE_AUTH = "false";
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
    const request = new Request("http://localhost:3000/api/chat", {
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
    const request = new Request("http://localhost:3000/api/chat", {
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
  });
});
