/**
 * @openapi
 * /api/test/oauth-refresh:
 *   get:
 *     summary: "Test OAuth token refresh functionality"
 *     description: |
 *       Development endpoint to test OAuth token refresh flow and Google Calendar API connectivity.
 *     responses:
 *       200:
 *         description: "OAuth test completed successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 testResult:
 *                   type: string
 *                   enum: [PASSED, FAILED, TOKEN_EXPIRED]
 *                 data:
 *                   type: object
 *       401:
 *         description: "Authentication required or token refresh failed"
 *       500:
 *         description: "OAuth test failed"
 */
/**
 * Test script to verify OAuth token refresh functionality
 * This script can be used during development to test the token refresh flow
 */

import { auth, createGoogleAuth } from "../../../../auth";
import { CalendarService } from "@/services/calendar-service";
import { ExtendedSession } from "@/types/auth";
import { NextResponse } from "next/server";

export async function GET() {
  console.log("🔍 Testing OAuth token refresh functionality...");

  try {
    const session = (await auth()) as ExtendedSession;

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("✅ Session found:", {
      user: session.user?.email,
      hasAccessToken: !!session.accessToken,
      hasRefreshToken: !!session.refreshToken,
      hasError: !!session.error,
    });

    // Check for token refresh errors
    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        {
          error: "Token refresh failed",
          message:
            "Please sign out and sign in again to refresh your permissions.",
          testResult: "FAILED",
        },
        { status: 401 }
      );
    }

    // Initialize Google Auth and Calendar Service
    const googleAuth = createGoogleAuth(
      session.accessToken,
      session.refreshToken
    );
    const calendarService = new CalendarService(googleAuth);

    console.log("🔧 Testing calendar API call...");

    // Try to make a simple calendar API call
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const events = await calendarService.getEvents(
      oneWeekAgo.toISOString(),
      now.toISOString(),
      10 // Just get 10 events for testing
    );

    console.log("✅ Calendar API call successful:", {
      eventsFound: events.items?.length || 0,
      hasNextPage: !!events.nextPageToken,
    });

    return NextResponse.json({
      success: true,
      message: "OAuth token refresh test completed successfully",
      testResult: "PASSED",
      data: {
        user: session.user?.email,
        eventsFound: events.items?.length || 0,
        hasNextPage: !!events.nextPageToken,
        hasRefreshToken: !!session.refreshToken,
        tokenError: session.error || null,
      },
    });
  } catch (error) {
    console.error("❌ OAuth token refresh test failed:", error);

    let errorDetails = "Unknown error";
    let testResult = "FAILED";

    if (error instanceof Error) {
      errorDetails = error.message;

      // Check if this is an authentication error that should trigger refresh
      if (
        error.message.includes("invalid authentication") ||
        error.message.includes("OAuth 2 access token") ||
        error.message.includes("authentication credential")
      ) {
        testResult = "TOKEN_EXPIRED";
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "OAuth token refresh test failed",
        testResult,
        error: errorDetails,
      },
      { status: 500 }
    );
  }
}
