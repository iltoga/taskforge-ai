/**
 * @openapi
 * /api/events:
 *   post:
 *     summary: "Create a new calendar event"
 *     description: |
 *       Creates a new event in the specified Google Calendar. Requires authentication and valid event data.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               summary:
 *                 type: string
 *                 description: "Event title (required)"
 *               description:
 *                 type: string
 *                 description: "Event description"
 *               start:
 *                 type: object
 *                 properties:
 *                   dateTime:
 *                     type: string
 *                     format: date-time
 *                     description: "Start date and time"
 *                   date:
 *                     type: string
 *                     format: date
 *                     description: "Start date for all-day events"
 *               end:
 *                 type: object
 *                 properties:
 *                   dateTime:
 *                     type: string
 *                     format: date-time
 *                     description: "End date and time"
 *                   date:
 *                     type: string
 *                     format: date
 *                     description: "End date for all-day events"
 *               calendarId:
 *                 type: string
 *                 description: "Calendar ID (default: primary)"
 *               location:
 *                 type: string
 *                 description: "Event location"
 *             required:
 *               - summary
 *     responses:
 *       200:
 *         description: "Event created successfully"
 *       400:
 *         description: "Bad request (missing required fields)"
 *       401:
 *         description: "Authentication required or expired"
 *       500:
 *         description: "Failed to create event"
 */
import { auth, createGoogleAuth } from "@/lib/auth-compat";
import { CalendarService } from "@/services/calendar-service";
import { ExtendedSession } from "@/types/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = (await auth()) as ExtendedSession;

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check for token refresh errors
    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        {
          error:
            "Google Calendar authentication expired. Please sign out and sign in again to refresh your permissions.",
        },
        { status: 401 }
      );
    }

    const eventData = await request.json();

    if (!eventData.summary) {
      return NextResponse.json(
        { error: "Event title (summary) is required" },
        { status: 400 }
      );
    }

    // Extract calendarId from eventData, default to 'primary'
    const calendarId = eventData.calendarId || "primary";
    console.log(`📅 Using calendar: ${calendarId}`);

    // Initialize calendar service
    const googleAuth = createGoogleAuth(
      session.accessToken,
      session.refreshToken
    );
    const calendarService = new CalendarService(googleAuth);

    console.log(`📅 Creating new event:`, eventData);

    // Create the event
    const newEvent = await calendarService.createEvent(eventData, calendarId);

    console.log(`✅ Event created successfully:`, newEvent.id);

    return NextResponse.json({
      success: true,
      event: newEvent,
      message: "Event created successfully",
    });
  } catch (error) {
    console.error("Create event API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create event",
      },
      { status: 500 }
    );
  }
}
