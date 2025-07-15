import {
  addChatMessage,
  getSessionData,
  setFileSearchSignature,
  setProcessedFiles,
  updateSessionData,
} from "@/lib/session-manager";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const sessionData = await getSessionData();

    return NextResponse.json({
      success: true,
      data: sessionData,
      message: "Session data retrieved successfully",
    });
  } catch (error) {
    console.error("❌ Error getting session data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "updateSession":
        await updateSessionData(data);
        break;

      case "setFileSignature":
        await setFileSearchSignature(data.signature);
        break;

      case "addMessage":
        await addChatMessage(data.message);
        break;

      case "setFiles":
        await setProcessedFiles(data.files);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return NextResponse.json({
      success: true,
      message: `Action ${action} completed successfully`,
    });
  } catch (error) {
    console.error("❌ Error updating session data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
