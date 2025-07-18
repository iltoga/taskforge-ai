/**
 * @openapi
 * /api/api-docs:
 *   get:
 *     summary: "Get OpenAPI specification"
 *     description: |
 *       Returns the complete OpenAPI specification for the TaskForge AI API in JSON format.
 *     responses:
 *       200:
 *         description: "OpenAPI specification"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
import { createSwaggerSpec } from "next-swagger-doc";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  const spec = createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
      openapi: "3.0.0",
      info: {
        title: "TaskForge AI API",
        version: "1.0.0",
      },
    },
  });
  return NextResponse.json(spec);
}
