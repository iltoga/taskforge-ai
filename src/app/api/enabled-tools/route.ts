/**
 * @openapi
 * /api/enabled-tools:
 *   get:
 *     summary: "Get enabled tools"
 *     description: |
 *       Retrieves a list of all enabled tools in the system, including calendar, email, web, passport, and file search tools.
 *     responses:
 *       200:
 *         description: "Enabled tools retrieved successfully"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabledTools:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *       500:
 *         description: "Failed to load enabled tools"
 */
import { loadToolConfiguration } from "@/tools/tool-registry";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // This endpoint is UI-only: just expose which categories are enabled
    // without performing any auth or contacting Google APIs.
    const cfg = loadToolConfiguration();
    const enabledTools = Object.entries(cfg)
      .filter((entry) => Boolean(entry[1]))
      .map(([category]) => ({
        name: `${category}-tools`,
        description: `Tools for ${category}`,
        category,
      }));

    return NextResponse.json({ enabledTools });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to load enabled tools",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
