import { CalendarEvent } from "../types/calendar";

/* Helper for shrinking event lists */
export function limitEventsContext(
  events: CalendarEvent[],
  maxEvents: number = 20
): CalendarEvent[] {
  return events
    .filter((e) => e.start)
    .sort(
      (a, b) =>
        new Date(b.start?.dateTime || b.start?.date || "").getTime() -
        new Date(a.start?.dateTime || a.start?.date || "").getTime()
    )
    .slice(0, maxEvents);
}

/* Regex-based keyword extraction */
export function extractSearchKeyword(msg: string): string | null {
  const patterns = [
    /search\s+(?:for\s+)?["']?([^"'\s]+)["']?/i,
    /find\s+(?:events?\s+)?(?:about\s+|with\s+)?["']?([^"'\s]+)["']?/i,
    /events?\s+(?:about\s+|with\s+|containing\s+)?["']?([^"'\s]+)["']?/i,
    /show\s+(?:me\s+)?(?:events?\s+)?(?:about\s+|with\s+)?["']?([^"'\s]+)["']?/i,
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

/* Very similar logic, just exported so AIService can delegate */
export function extractTimeRange(message: string): {
  start?: string;
  end?: string;
} {
  const lower = message.toLowerCase();
  const now = new Date();

  const range = (start: Date, end: Date) => ({
    start: start.toISOString(),
    end: end.toISOString(),
  });

  if (/(past|last|previous) week/.test(lower))
    return range(
      new Date(now.setDate(now.getDate() - now.getDay() - 7)),
      new Date(now.setDate(now.getDate() - now.getDay() - 1))
    );

  if (/(past|last|previous) month/.test(lower))
    return range(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    );

  if (/this week|current week/.test(lower))
    return range(
      new Date(now.setDate(now.getDate() - now.getDay())),
      new Date(now.setDate(now.getDate() - now.getDay() + 6))
    );

  if (/today/.test(lower))
    return range(
      new Date(now.setHours(0, 0, 0, 0)),
      new Date(now.setHours(23, 59, 59, 999))
    );

  if (/yesterday/.test(lower)) {
    const y = new Date(now.setDate(now.getDate() - 1));
    return range(
      new Date(y.setHours(0, 0, 0, 0)),
      new Date(y.setHours(23, 59, 59, 999))
    );
  }

  return range(
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  );
}
