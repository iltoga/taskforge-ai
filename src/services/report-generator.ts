import { generateTextWithProvider, type AIProviderConfig } from "@/lib/openai";
import { ModelType, supportsTemperature } from "../appconfig/models";
import { CalendarEvent } from "../types/calendar";

// Use central supportsTemperature helper; keep legacy constant removed

export async function generateReport(
  events: CalendarEvent[],
  company: string,
  startDate: string,
  endDate: string,
  reportType: "weekly" | "monthly" | "quarterly",
  model: ModelType,
  userName: string,
  providerConfig?: AIProviderConfig
): Promise<string> {
  /* --- helper builders (identical to old code) --- */
  const companyText = company ? ` for ${company}` : "";

  const systemPrompt =
    reportType === "weekly"
      ? `
You are tasked with generating a detailed weekly activity report for ${userName}.
Format the output as follows:

${userName}'s Weekly Activity Report${companyText} - [start date / end date]

For each day with events, list:
• [Activity 1]
...
**Summary:**`
      : reportType === "monthly"
      ? `
You are tasked with generating a comprehensive monthly activity report for ${userName}.
Format the output as follows:

${userName}'s Monthly Activity Report${companyText} - [start / end]

**Key Activities by Week:**`
      : `
You are tasked with generating a strategic quarterly activity report for ${userName}.
Format the output as follows:

${userName}'s Quarterly Activity Report${companyText} - [start / end]`;

  const userPrompt = `
Generate a ${reportType} work report${companyText} from ${startDate} to ${endDate}.

Events data:
${events
  .map(
    (e) =>
      `Date: ${e.start?.date || e.start?.dateTime}, Event: ${
        e.summary || "Untitled"
      }${e.location ? ` (Location: ${e.location})` : ""}`
  )
  .join("\n")}

Total events in period: ${events.length}
`;

  const supportsTemp = supportsTemperature(model);

  const { text } = await generateTextWithProvider(
    userPrompt,
    providerConfig || {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY!,
    },
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: supportsTemp ? 0.3 : undefined,
    }
  );

  return text || "";
}

export function generateWeeklyReport(
  events: CalendarEvent[],
  company: string,
  startDate: string,
  endDate: string,
  model: ModelType,
  userName: string,
  providerConfig?: AIProviderConfig
) {
  return generateReport(
    events,
    company,
    startDate,
    endDate,
    "weekly",
    model,
    userName,
    providerConfig
  );
}
