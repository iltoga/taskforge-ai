/**
 * @openapi
 * /api/reports:
 *   post:
 *     summary: "Generate a report (weekly, monthly, or quarterly)"
 *     description: |
 *       Generates a report for a specified date range and (optionally) company. Requires authentication. Returns a summary and event details.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company:
 *                 type: string
 *                 description: "Company name to filter events (optional)"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: "Start date of the report period (YYYY-MM-DD)"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: "End date of the report period (YYYY-MM-DD)"
 *               calendarId:
 *                 type: string
 *                 description: "Calendar ID to use (default: primary)"
 *               model:
 *                 type: string
 *                 description: "AI model to use (default: gpt-4.1-mini)"
 *               reportType:
 *                 type: string
 *                 enum: [weekly, monthly, quarterly]
 *                 description: "Type of report (default: weekly)"
 *             required:
 *               - startDate
 *               - endDate
 *     responses:
 *       200:
 *         description: "Report generated successfully"
 *       400:
 *         description: "Bad request (missing required fields)"
 *       401:
 *         description: "Authentication required or expired"
 *       404:
 *         description: "No events found for the specified criteria"
 *       500:
 *         description: "Failed to generate report"
 */
import { ModelType } from "@/appconfig/models";
import { auth, createGoogleAuth } from "@/lib/auth-compat";
import { isServiceAccountMode } from "@/lib/calendar-config";
import { AIService } from "@/services/ai-service";
import { CalendarService } from "@/services/calendar-service";
import { EnhancedCalendarService } from "@/services/enhanced-calendar-service";
import { ExtendedSession } from "@/types/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  console.log("🚀 Reports API called");

  try {
    const session = (await auth()) as ExtendedSession;
    console.log("🔐 Session check:", session ? "Session exists" : "No session");

    // Check authentication modes
    const isBypassMode = process.env.BYPASS_GOOGLE_AUTH === "true";
    const useServiceAccountMode = isBypassMode || isServiceAccountMode();

    // If bypass mode is enabled, always use service account for calendar operations
    if (!session && !isBypassMode) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check for token refresh errors in OAuth mode only
    if (
      !useServiceAccountMode &&
      session?.error === "RefreshAccessTokenError"
    ) {
      return NextResponse.json(
        {
          error:
            "Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      company,
      startDate,
      endDate,
      calendarId: rawCalendarId = "primary",
      model = "gpt-4.1-mini",
      reportType = "weekly",
    } = body as {
      company?: string;
      startDate: string;
      endDate: string;
      calendarId?: string;
      model?: ModelType;
      reportType?: "weekly" | "monthly" | "quarterly";
    };

    let calendarId = rawCalendarId;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required" },
        { status: 400 }
      );
    }

    console.log(`📅 Using calendar: ${calendarId}`);
    console.log(`📊 Report type: ${reportType}`);

    // Initialize calendar service based on authentication mode
    let calendarService: CalendarService;

    if (useServiceAccountMode) {
      // Service Account Mode: Use service account for calendar operations
      const enhancedService = await EnhancedCalendarService.createWithFallback(
        undefined,
        true
      );
      calendarService = enhancedService as unknown as CalendarService;

      if (isBypassMode) {
        console.log(
          "🔧 Bypass mode: Using service account authentication for calendar operations"
        );
      } else {
        console.log(
          "🔧 Using service account authentication for calendar operations"
        );
      }

      // In service account mode, use the configured calendar
      const { loadAllowedCalendars, decodeCalendarId } = await import(
        "@/lib/calendar-config"
      );
      const allowedCalendars = loadAllowedCalendars();

      if (allowedCalendars.length > 0) {
        const decodedCalendarId = decodeCalendarId(allowedCalendars[0].cid);
        console.log(
          `📅 Service account mode: Using configured calendar: ${decodedCalendarId}`
        );
        // Update calendarId to use the configured calendar
        calendarId = decodedCalendarId;
      }
    } else {
      // OAuth Mode: Use user OAuth for calendar operations
      if (!session?.accessToken) {
        return NextResponse.json(
          { error: "Authentication required - OAuth access token missing" },
          { status: 401 }
        );
      }
      const googleAuth = createGoogleAuth(
        session.accessToken,
        session.refreshToken
      );
      calendarService = new CalendarService(googleAuth);
      console.log("🔐 Using user OAuth authentication for calendar operations");
    }

    const aiService = new AIService();

    // Get work report events for the specified date range
    const events = await calendarService.getEvents(
      startDate,
      endDate,
      250,
      undefined,
      false,
      "startTime",
      undefined,
      calendarId
    );

    // Debug: Log event count and first few summaries
    console.log(
      `📅 Found ${events.items.length} events between ${startDate} and ${endDate}`
    );
    if (events.items.length > 0) {
      console.log(
        "Sample event summaries:",
        events.items.slice(0, 3).map((e) => e.summary)
      );
    }

    // Filter events based on company if provided, otherwise include all events
    const filteredEvents = events.items.filter((event) => {
      const summary = event.summary?.toLowerCase() || "";
      if (company && company.trim()) {
        // If company is provided, look for events containing the company name
        return summary.includes(company.toLowerCase());
      }
      // If no company filter, include all events
      return true;
    });

    // Improved error handling with detailed messages
    if (filteredEvents.length === 0) {
      const errorDetails = {
        company,
        startDate,
        endDate,
        reportType,
        totalEvents: events.items.length,
        sampleSummaries: events.items.slice(0, 3).map((e) => e.summary),
      };

      console.error("❌ No events found:", errorDetails);
      return NextResponse.json(
        {
          success: false,
          error:
            company && company.trim()
              ? "No events found for the specified company and date range"
              : "No events found for the specified date range",
          details: errorDetails,
        },
        { status: 404 }
      );
    }

    // Try generating the report
    try {
      // Extract user name from session, fallback to 'User' if not available
      const userName =
        session.user?.name || session.user?.email?.split("@")[0] || "User";

      const report = await aiService.generateReport(
        filteredEvents,
        company ?? "",
        startDate,
        endDate,
        reportType,
        model,
        userName
      );

      return NextResponse.json({
        success: true,
        report: {
          period: `${startDate} to ${endDate}`,
          reportType,
          totalEvents: filteredEvents.length,
          workingHours: 0, // This could be calculated if needed
          meetingHours: 0, // This could be calculated if needed
          summary: report,
          events: filteredEvents.map((event) => ({
            title: event.summary || "Untitled Event",
            description: event.description || null,
            location: event.location || null,
            duration:
              event.start?.dateTime && event.end?.dateTime
                ? `${new Date(
                    event.start.dateTime
                  ).toLocaleTimeString()} - ${new Date(
                    event.end.dateTime
                  ).toLocaleTimeString()}`
                : "All day",
            startDate: event.start?.dateTime || event.start?.date || null,
            endDate: event.end?.dateTime || event.end?.date || null,
            startTimeZone: event.start?.timeZone || null,
            endTimeZone: event.end?.timeZone || null,
            type: "calendar-event",
            status: event.status || null,
            attendees: event.attendees?.length || 0,
            isAllDay: !event.start?.dateTime,
          })),
        },
        eventsCount: filteredEvents.length,
      });
    } catch (genError) {
      console.error("❌ Report generation failed:", genError);
      return NextResponse.json(
        {
          success: false,
          error: "Report generation failed",
          details:
            genError instanceof Error ? genError.message : String(genError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Reports API error:", error);

    // Provide more specific error messages
    let errorMessage = "Failed to generate report. Please try again.";

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage =
          "OpenAI API key is invalid or missing. Please check your configuration.";
      } else if (error.message.includes("rate limit")) {
        errorMessage =
          "Rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes("model")) {
        errorMessage =
          "The selected AI model is not available for report generation.";
      } else if (error.message.includes("calendar")) {
        errorMessage =
          "Calendar access error. Please check your Google Calendar permissions.";
      } else {
        errorMessage = `Report generation error: ${error.message}`;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
