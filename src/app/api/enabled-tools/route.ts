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
import { getMCPApi } from "@/services/mcp/mcp-api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get internal tool categories
    const cfg = loadToolConfiguration();
    const internalTools = Object.entries(cfg)
      .filter((entry) => Boolean(entry[1]))
      .map(([category]) => ({
        name: `${category}-tools`,
        description: `Tools for ${category}`,
        category,
      }));

    // Get MCP tool categories
    const mcpTools: Array<{ name: string; description: string; category: string }> = [];
    try {
      const mcpApi = getMCPApi();
      const availableTools = await mcpApi.getAvailableTools();
      
      // Group MCP tools by category
      const mcpCategories = new Set<string>();
      availableTools.forEach(tool => {
        const category = tool.serverName; // Use server name as category
        mcpCategories.add(category);
      });
      
      // Add MCP categories to the result
      mcpCategories.forEach(category => {
        mcpTools.push({
          name: `mcp-${category}-tools`,
          description: `MCP ${category} tools`,
          category: `mcp-${category}`,
        });
      });
    } catch (error) {
      console.warn("Failed to get MCP tools for UI:", error);
      // Continue without MCP tools if there's an error
    }

    const enabledTools = [...internalTools, ...mcpTools];
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
