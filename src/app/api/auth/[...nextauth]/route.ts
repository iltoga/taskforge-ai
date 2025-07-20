/**
 * @openapi
 * /api/auth/{provider}:
 *   get:
 *     summary: "NextAuth.js authentication endpoints"
 *     description: |
 *       Handles authentication flows for various providers (Google, etc.). This is a dynamic route that handles signin, signout, callbacks, and session management.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: "Authentication provider or action (signin, signout, callback, session, etc.)"
 *     responses:
 *       200:
 *         description: "Authentication response"
 *       302:
 *         description: "Redirect response"
 *       400:
 *         description: "Bad request"
 *       401:
 *         description: "Authentication failed"
 *   post:
 *     summary: "NextAuth.js authentication POST endpoints"
 *     description: |
 *       Handles POST requests for authentication flows, including signin and signout.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: "Authentication provider or action"
 *     responses:
 *       200:
 *         description: "Authentication response"
 *       302:
 *         description: "Redirect response"
 *       400:
 *         description: "Bad request"
 *       401:
 *         description: "Authentication failed"
 */

// Force Node.js runtime to prevent duplicate callbacks with Prisma adapter
export const runtime = "nodejs";

import { handlers } from "../../../../../auth";

export const GET = handlers.GET;
export const POST = handlers.POST;
