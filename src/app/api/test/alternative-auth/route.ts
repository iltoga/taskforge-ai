/**
 * @openapi
 * /api/test/alternative-auth:
 *   get:
 *     summary: "Test alternative authentication system"
 *     description: |
 *       Tests the alternative authentication system including service account, OAuth, and fallback mechanisms.
 *     parameters:
 *       - in: query
 *         name: serviceAccount
 *         schema:
 *           type: boolean
 *         description: "Force service account authentication"
 *     responses:
 *       200:
 *         description: "Authentication test completed"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 results:
 *                   type: object
 *                   properties:
 *                     serviceAccountAvailable:
 *                       type: boolean
 *                     userOAuthAvailable:
 *                       type: boolean
 *                     tests:
 *                       type: object
 *                     summary:
 *                       type: object
 *       500:
 *         description: "Authentication test failed"
 */
import {
  auth,
  getServiceAccountAuth,
  isServiceAccountAvailable,
} from "../../../../auth";
import { EnhancedCalendarService } from "@/services/enhanced-calendar-service";
import { ExtendedSession } from "@/types/auth";
import { NextResponse } from "next/server";

interface TestResult {
  success: boolean;
  authType?: string;
  canFallback?: boolean;
  message?: string;
  error?: string;
}

interface AuthTestResults {
  serviceAccountAvailable: boolean;
  userOAuthAvailable: boolean;
  tests: {
    serviceAccount?: TestResult;
    userOAuth?: TestResult;
    fallback?: TestResult;
  };
  summary?: {
    successful: number;
    total: number;
    allPassed: boolean;
    status: string;
  };
}

/**
 * Test endpoint for alternative authentication system
 * This endpoint demonstrates the fallback functionality
 */
export async function GET(request: Request) {
  try {
    console.log("🧪 Testing alternative authentication system...");

    const session = (await auth()) as ExtendedSession;
    const { searchParams } = new URL(request.url);
    const forceServiceAccount = searchParams.get("serviceAccount") === "true";

    // Test service account availability
    const serviceAccountAvailable = isServiceAccountAvailable();
    console.log(`🔍 Service account available: ${serviceAccountAvailable}`);

    const authResults: AuthTestResults = {
      serviceAccountAvailable,
      userOAuthAvailable: !!session?.accessToken,
      tests: {},
    };

    // Test 1: Service Account Authentication (if available)
    if (serviceAccountAvailable) {
      try {
        console.log("🔧 Testing service account authentication...");
        const serviceAuth = await getServiceAccountAuth();

        if (serviceAuth) {
          const serviceCalendarService =
            await EnhancedCalendarService.createWithFallback(
              undefined,
              true // prefer service account
            );

          const authType = serviceCalendarService.getAuthType();
          console.log(
            `✅ Service account test successful, auth type: ${authType}`
          );

          authResults.tests.serviceAccount = {
            success: true,
            authType,
            message: "Service account authentication working",
          };
        }
      } catch (error) {
        console.error("❌ Service account test failed:", error);
        authResults.tests.serviceAccount = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    } else {
      authResults.tests.serviceAccount = {
        success: false,
        error: "Service account credentials not available",
      };
    }

    // Test 2: User OAuth Authentication (if available)
    if (session?.accessToken && !forceServiceAccount) {
      try {
        console.log("🔐 Testing user OAuth authentication...");

        // Import createGoogleAuth here to avoid circular imports
        const { createGoogleAuth } = await import("../../../../auth");
        const userAuth = createGoogleAuth(
          session.accessToken,
          session.refreshToken
        );

        const userCalendarService =
          await EnhancedCalendarService.createWithFallback(userAuth, false);
        const authType = userCalendarService.getAuthType();

        console.log(`✅ User OAuth test successful, auth type: ${authType}`);

        authResults.tests.userOAuth = {
          success: true,
          authType,
          message: "User OAuth authentication working",
        };
      } catch (error) {
        console.error("❌ User OAuth test failed:", error);
        authResults.tests.userOAuth = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    } else {
      authResults.tests.userOAuth = {
        success: false,
        error: forceServiceAccount
          ? "Skipped (forced service account)"
          : "User not authenticated",
      };
    }

    // Test 3: Automatic Fallback
    try {
      console.log("🔄 Testing automatic fallback...");

      let primaryAuth = undefined;
      if (session?.accessToken && !forceServiceAccount) {
        const { createGoogleAuth } = await import("../../../../auth");
        primaryAuth = createGoogleAuth(
          session.accessToken,
          session.refreshToken
        );
      }

      const fallbackService = await EnhancedCalendarService.createWithFallback(
        primaryAuth,
        forceServiceAccount
      );
      const authType = fallbackService.getAuthType();
      const canFallback = fallbackService.canFallbackToServiceAccount();

      console.log(
        `✅ Fallback test successful, auth type: ${authType}, can fallback: ${canFallback}`
      );

      authResults.tests.fallback = {
        success: true,
        authType,
        canFallback,
        message: "Automatic fallback working",
      };
    } catch (error) {
      console.error("❌ Fallback test failed:", error);
      authResults.tests.fallback = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // Calculate overall status
    const allTests = Object.values(authResults.tests) as TestResult[];
    const successfulTests = allTests.filter(
      (test: TestResult) => test.success
    ).length;
    const totalTests = allTests.length;

    authResults.summary = {
      successful: successfulTests,
      total: totalTests,
      allPassed: successfulTests === totalTests,
      status: successfulTests === totalTests ? "PASS" : "PARTIAL",
    };

    console.log(
      `🎯 Alternative authentication test summary: ${successfulTests}/${totalTests} tests passed`
    );

    return NextResponse.json({
      success: true,
      message: "Alternative authentication system test completed",
      results: authResults,
    });
  } catch (error) {
    console.error("❌ Alternative authentication test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Alternative authentication system test failed",
      },
      { status: 500 }
    );
  }
}
