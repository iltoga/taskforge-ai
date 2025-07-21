/**
 * @jest-environment node
 */

/**
 * Functional test for the chat API endpoint
 * Tests the complete filtering workflow including AI processing and calendar filtering
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

import { POST } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

// Mock next-auth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
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

import { createGoogleAuth } from "@/lib/auth";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";
import { getServerSession } from "next-auth";

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockCreateGoogleAuth = createGoogleAuth as jest.MockedFunction<
  typeof createGoogleAuth
>;
const MockedCalendarService = CalendarService as jest.MockedClass<
  typeof CalendarService
>;
const MockedAIService = AIService as jest.MockedClass<typeof AIService>;

describe("Chat API - TechcorpFiltering Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authenticated session
    mockGetServerSession.mockResolvedValue({
      accessToken: "mock_access_token",
      user: { email: "test@example.com" },
    } as any);

    // Mock Google auth
    mockCreateGoogleAuth.mockReturnValue({} as any);

    // Set up environment variable
    process.env.OPENAI_API_KEY = "mock_openai_key";
  });

  test("should correctly filter techcorpevents from march to june 2025", async () => {
    // Mock calendar events data
    const mockCalendarEvents = {
      items: [
        {
          id: "1",
          summary: "Meeting with TechcorpTeam",
          description: "Quarterly review with nespola",
          start: { dateTime: "2025-04-15T14:00:00+08:00" },
          end: { dateTime: "2025-04-15T15:00:00+08:00" },
          htmlLink: "https://calendar.google.com/event?eid=1",
        },
        {
          id: "2",
          summary: "Daily Report - Nespola",
          description: "Daily activities for techoneproject",
          start: { date: "2025-05-10" },
          end: { date: "2025-05-11" },
          htmlLink: "https://calendar.google.com/event?eid=2",
        },
        {
          id: "3",
          summary: "Team Meeting",
          description: "General team sync",
          start: { dateTime: "2025-04-20T10:00:00+08:00" },
          end: { dateTime: "2025-04-20T11:00:00+08:00" },
          htmlLink: "https://calendar.google.com/event?eid=3",
        },
        {
          id: "4",
          summary: "TechcorpProject Review",
          description: "Review project milestones",
          start: { dateTime: "2025-05-25T16:00:00+08:00" },
          end: { dateTime: "2025-05-25T17:00:00+08:00" },
          htmlLink: "https://calendar.google.com/event?eid=4",
        },
        {
          id: "5",
          summary: "Random Work Meeting",
          description: "Some other work",
          start: { dateTime: "2025-04-10T09:00:00+08:00" },
          end: { dateTime: "2025-04-10T10:00:00+08:00" },
          htmlLink: "https://calendar.google.com/event?eid=5",
        },
      ],
    };

    // Mock AI service to return correct action for techonequery
    const mockAIProcessMessage = jest.fn().mockResolvedValue({
      type: "list",
      timeRange: {
        start: "2025-03-01T00:00:00+08:00",
        end: "2025-06-30T23:59:59+08:00",
      },
    });

    const mockAITranslate = jest
      .fn()
      .mockResolvedValue(
        "list all events relative to techcorpfrom march to june 2025"
      );

    MockedAIService.mockImplementation(
      () =>
        ({
          processMessage: mockAIProcessMessage,
          translateToEnglish: mockAITranslate,
        } as any)
    );

    // Mock calendar service to return the mock events
    const mockGetEvents = jest.fn().mockResolvedValue(mockCalendarEvents);

    MockedCalendarService.mockImplementation(
      () =>
        ({
          getEvents: mockGetEvents,
        } as any)
    );

    // Create request
    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "list all events relative to techcorpfrom march to june 2025",
        model: "gpt-4.1-mini",
      }),
    });

    // Call the API
    const response = await POST(request);
    const responseData = await response.json();

    // Verify AI was called correctly
    expect(mockAIProcessMessage).toHaveBeenCalledWith(
      "list all events relative to techcorpfrom march to june 2025",
      mockCalendarEvents.items,
      "gpt-4.1-mini"
    );

    // Verify calendar service was called with correct date range (no search query since we do client-side filtering)
    expect(mockGetEvents).toHaveBeenCalledWith(
      "2025-03-01T00:00:00+08:00",
      "2025-06-30T23:59:59+08:00",
      2500,
      undefined, // No server-side search query
      false,
      "startTime",
      "Asia/Makassar"
    );

    // Check response
    expect(response.status).toBe(200);
    expect(responseData).toHaveProperty("message");
    expect(responseData).toHaveProperty("events");

    // Verify filtering worked - should only include events with 'nespola'
    const filteredEvents = responseData.events;

    console.log("🔍 Total events returned:", filteredEvents.length);
    console.log(
      "📋 Event titles:",
      filteredEvents.map((e: any) => e.summary)
    );

    // Should filter to only 3 events containing 'nespola'
    expect(filteredEvents.length).toBe(3);

    const eventTitles = filteredEvents.map((e: any) => e.summary);
    expect(eventTitles).toContain("Meeting with TechcorpTeam");
    expect(eventTitles).toContain("Daily Report - Nespola");
    expect(eventTitles).toContain("TechcorpProject Review");

    // Should NOT contain events without 'nespola'
    expect(eventTitles).not.toContain("Team Meeting");
    expect(eventTitles).not.toContain("Random Work Meeting");

    // Verify each returned event contains 'nespola'
    filteredEvents.forEach((event: any) => {
      const summary = event.summary?.toLowerCase() || "";
      const description = event.description?.toLowerCase() || "";
      const containsNespola =
        summary.includes("nespola") || description.includes("nespola");
      expect(containsNespola).toBe(true);
    });

    console.log(
      '✅ Test passed: Only events containing "nespola" were returned'
    );
  });

  test("should handle case-insensitive filtering", async () => {
    const mockEvents = {
      items: [
        {
          id: "1",
          summary: "NESPOLA Team Meeting",
          description: "Meeting with NESPOLA team",
          start: { dateTime: "2025-04-15T14:00:00+08:00" },
          end: { dateTime: "2025-04-15T15:00:00+08:00" },
        },
        {
          id: "2",
          summary: "Project nEsPoLa Update",
          description: "Update on project",
          start: { dateTime: "2025-05-10T10:00:00+08:00" },
          end: { dateTime: "2025-05-10T11:00:00+08:00" },
        },
      ],
    };

    // Mock services
    MockedAIService.mockImplementation(
      () =>
        ({
          processMessage: jest.fn().mockResolvedValue({
            type: "list",
            timeRange: {
              start: "2025-03-01T00:00:00+08:00",
              end: "2025-06-30T23:59:59+08:00",
            },
          }),
          translateToEnglish: jest
            .fn()
            .mockResolvedValue("list events for nespola"),
        } as any)
    );

    MockedCalendarService.mockImplementation(
      () =>
        ({
          getEvents: jest.fn().mockResolvedValue(mockEvents),
        } as any)
    );

    const request = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: "list events for nespola",
        model: "gpt-4.1-mini",
      }),
    });

    const response = await POST(request);
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData.events.length).toBe(2); // Both events should match case-insensitively

    console.log("✅ Case-insensitive filtering works correctly");
  });
});
