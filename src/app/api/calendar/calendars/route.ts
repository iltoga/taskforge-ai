/**
 * @openapi
 * /api/calendar/calendars:
 *   get:
 *     summary: "Get available calendars"
 *     description: |
 *       Retrieves a list of available calendars. In OAuth mode, fetches from user's Google account. In service account mode, returns predefined allowed calendars.
 *     responses:
 *       200:
 *         description: "Calendars retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 calendars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       summary:
 *                         type: string
 *                       primary:
 *                         type: boolean
 *                       accessRole:
 *                         type: string
 *                 mode:
 *                   type: string
 *                   enum: [oauth, service-account]
 *                 message:
 *                   type: string
 *       401:
 *         description: "Authentication required"
 *       500:
 *         description: "Failed to fetch calendars"
 */
import { auth } from "@/lib/auth-compat";
import {
  getServiceAccountCalendars,
  isServiceAccountMode,
} from "@/lib/calendar-config";
import { ExtendedSession } from "@/types/auth";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createGoogleAuth } from "../../../../../auth";

export async function GET() {
  try {
    const session = (await auth()) as ExtendedSession;
    const useServiceAccountMode = isServiceAccountMode();

    // Always require user authentication for the app
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (useServiceAccountMode) {
      // Service Account Mode: Return predefined calendars from config
      console.log(
        "📅 Fetching calendars from allowed-calendars.json (service account mode)"
      );
      const calendars = getServiceAccountCalendars();

      return NextResponse.json({
        calendars,
        mode: "service-account",
        message: `Found ${calendars.length} allowed calendars`,
      });
    } else {
      // OAuth Mode: Fetch calendars from user's Google account
      console.log(
        "📅 Fetching calendars from Google Calendar API (OAuth mode)"
      );

      if (!session.accessToken) {
        return NextResponse.json(
          { error: "OAuth access token missing" },
          { status: 401 }
        );
      }

      const googleAuth = createGoogleAuth(
        session.accessToken,
        session.refreshToken
      );
      const calendar = google.calendar({ version: "v3", auth: googleAuth });

      const response = await calendar.calendarList.list();
      const calendars =
        response.data.items?.map((cal) => ({
          id: cal.id!,
          summary: cal.summary!,
          primary: cal.primary || false,
          accessRole: cal.accessRole,
          backgroundColor: cal.backgroundColor,
        })) || [];

      return NextResponse.json({
        calendars,
        mode: "oauth",
        message: `Found ${calendars.length} calendars from Google account`,
      });
    }
  } catch (error) {
    console.error("Error fetching calendars:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch calendars",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
