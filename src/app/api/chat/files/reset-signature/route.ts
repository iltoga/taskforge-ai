import { resetFileSearchSignature } from "@/lib/file-search-session";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await resetFileSearchSignature();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
