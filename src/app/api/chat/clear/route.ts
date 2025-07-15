import { auth } from "@/lib/auth-compat";
import { clearUserChatData } from "@/services/user-chat-data-service";
import { NextResponse } from "next/server";

/**
 * Clear Chat API Route
 *
 * This endpoint clears all persistent chat data for the authenticated user:
 * - Chat history (conversations)
 * - Processed files (uploaded files metadata)
 * - File search signature (cache validation)
 *
 * This is called when the user clicks the "Clear Chat" button in the UI.
 */
export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Clear all chat data for the user
    await clearUserChatData(session.user.id);

    console.log(`🧹 Cleared chat data for user: ${session.user.id}`);

    return NextResponse.json({
      success: true,
      message: "Chat data cleared successfully",
    });
  } catch (error) {
    console.error("❌ Error clearing chat data:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear chat data. Please try again.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET method not allowed - this endpoint only supports POST
 */
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to clear chat data." },
    { status: 405 }
  );
}
