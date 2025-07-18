import { auth, createGoogleAuth } from "@/lib/auth-compat";
import { isServiceAccountMode } from "@/lib/calendar-config";
import { CalendarService } from "@/services/calendar-service";
import { EnhancedCalendarService } from "@/services/enhanced-calendar-service";
import { ExtendedSession } from "@/types/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = (await auth()) as ExtendedSession;

    // Check authentication modes
    const isBypassMode = process.env.BYPASS_GOOGLE_AUTH === "true";
    const useServiceAccountMode = isBypassMode || isServiceAccountMode();

    // If bypass mode is enabled, always use service account for calendar operations
    // In service account mode, we still need user authentication for the app
    // but calendar operations will use service account
    if (!session && !isBypassMode) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check for token refresh errors in OAuth mode (only when not bypassing and not using service account)
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

    // Get calendarId from query parameters
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId") || "primary";

    console.log(`📅 Using calendar: ${calendarId}`);

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

    // Get events for the next 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    console.log(
      `📅 Fetching upcoming events from ${now.toISOString()} to ${sevenDaysFromNow.toISOString()}`
    );

    // Determine the actual calendar ID to use
    let actualCalendarId = calendarId;

    if (useServiceAccountMode) {
      if (isBypassMode) {
        // In bypass mode, use the configured calendar (your calendar)
        const { loadAllowedCalendars, decodeCalendarId } = await import(
          "@/lib/calendar-config"
        );
        const allowedCalendars = loadAllowedCalendars();

        if (allowedCalendars.length > 0) {
          actualCalendarId = decodeCalendarId(allowedCalendars[0].cid);
          console.log(
            `📅 Bypass mode: Using configured calendar: ${actualCalendarId}`
          );
        } else {
          console.warn("⚠️ No allowed calendars configured for bypass mode");
          actualCalendarId = "primary"; // Fallback to service account's own calendar
        }
      } else if (calendarId === "primary") {
        // In service account mode (non-bypass), use the configured calendar
        const { loadAllowedCalendars, decodeCalendarId } = await import(
          "@/lib/calendar-config"
        );
        const allowedCalendars = loadAllowedCalendars();

        if (allowedCalendars.length > 0) {
          actualCalendarId = decodeCalendarId(allowedCalendars[0].cid);
          console.log(
            `📅 Service account mode: Using configured calendar: ${actualCalendarId}`
          );
        } else {
          console.warn(
            "⚠️ No allowed calendars configured for service account mode"
          );
          actualCalendarId = "primary"; // Fallback to service account's own calendar
        }
      }
    }

    const events = await calendarService.getEvents(
      now.toISOString(),
      sevenDaysFromNow.toISOString(),
      50, // maxResults
      undefined, // No search query
      false, // showDeleted
      "startTime", // orderBy
      undefined, // Use default timezone
      actualCalendarId // Use the determined calendar ID
    );

    console.log(`📅 Found ${events.items.length} upcoming events`);
    if (events.items.length > 0) {
      console.log(
        "Sample events:",
        events.items.slice(0, 3).map((e) => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      events: events.items,
      count: events.items.length,
    });
  } catch (error) {
    console.error("Upcoming events API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch upcoming events",
      },
      { status: 500 }
    );
  }
}
