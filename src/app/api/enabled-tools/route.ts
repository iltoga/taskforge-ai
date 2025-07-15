import { NextResponse } from "next/server";

import { createGoogleAuthWithFallback } from "@/lib/auth-compat";
import { CalendarService } from "@/services/calendar-service";
import { CalendarTools } from "@/tools/calendar-tools";
import { EmailTools } from "@/tools/email-tools";
import { FileSearchTools } from "@/tools/file-search-tools";
import { PassportTools } from "@/tools/passport-tools";
import { createToolRegistry } from "@/tools/tool-registry";
import { WebTools } from "@/tools/web-tools";

export async function GET() {
  try {
    // Use service account fallback for this endpoint (no user context)
    const googleAuth = await createGoogleAuthWithFallback(
      undefined,
      undefined,
      true
    );
    const calendarService = new CalendarService(googleAuth);
    const calendarTools = new CalendarTools(calendarService);
    const emailTools = new EmailTools();
    const webTools = new WebTools();
    const passportTools = new PassportTools();
    const fileSearchTools = new FileSearchTools();

    // Only enabled tools will be registered
    const registry = createToolRegistry(
      calendarTools,
      emailTools,
      webTools,
      passportTools,
      fileSearchTools
    );
    const enabledTools = registry.getAvailableTools();
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
