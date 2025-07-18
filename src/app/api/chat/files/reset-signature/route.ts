/**
 * @openapi
 * /api/chat/files/reset-signature:
 *   post:
 *     summary: "Reset file search signature"
 *     description: |
 *       Resets the file search signature cache, forcing a refresh of file search capabilities.
 *     responses:
 *       200:
 *         description: "File search signature reset successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: "Failed to reset file search signature"
 */
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
