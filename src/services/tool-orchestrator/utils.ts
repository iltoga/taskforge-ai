import { ToolExecution } from "@/tools/tool-registry";
import { ChatHistory } from "@/types/chat";

/* ------------------------------------------------------------------ */
/* PARAMETER‐HELPER                                                   */
/* ------------------------------------------------------------------ */
export function getToolParameterInfo(
  toolName: string,
  vectorStoreIds: string[]
): string {
  switch (toolName) {
    /* Calendar */
    case "getEvents":
      return '{ timeRange?: { start?: string (ISO), end?: string (ISO) }, filters?: { query?: string, maxResults?: number, showDeleted?: boolean, orderBy?: "startTime" | "updated" } }';
    case "searchEvents":
      return "{ query: string (required), timeRange?: { start?: string (ISO), end?: string (ISO) } }";
    case "createEvent":
      return "{ eventData: { summary: string (required), description?: string, start: { dateTime?: string (ISO) | date?: string (YYYY-MM-DD) }, end: { dateTime?: string (ISO) | date?: string (YYYY-MM-DD) }, location?: string, attendees?: [{ email: string, displayName?: string }] } }";
    case "updateEvent":
      return "{ eventId: string (required), changes: Partial<eventData> }";
    case "deleteEvent":
      return "{ eventId: string (required) }";

    /* Email */
    case "sendEmail":
      return '{ emailData: { to: string[] (required), cc?: string[], bcc?: string[], subject: string (required), body: string (required), priority?: "low" | "normal" | "high", isHtml?: boolean } }';
    case "searchEmails":
      return "{ filters: { from?: string, to?: string, subject?: string, body?: string, hasAttachment?: boolean, isRead?: boolean, dateRange?: { start?: string, end?: string }, maxResults?: number } }";
    case "replyToEmail":
      return "{ emailId: string (required), replyData: { body: string (required), replyAll?: boolean } }";

    /* File */
    case "listFiles":
      return "{ directoryPath: string (required), recursive?: boolean }";
    case "readFile":
      return "{ filePath: string (required) }";
    case "writeFile":
      return "{ filePath: string (required), content: string (required), overwrite?: boolean }";
    case "searchFiles":
      return '{ searchPath: string (required), filters: { name?: string, extension?: string, type?: "file" | "directory", sizeMin?: number, sizeMax?: number, maxResults?: number } }';

    /* Web */
    case "searchWeb":
      return "{ query: string (required), filters?: { site?: string, maxResults?: number } }";
    case "getWebPageContent":
      return "{ url: string (required) }";
    case "summarizeWebPage":
      return "{ url: string (required), maxLength?: number }";
    case "checkWebsite":
      return "{ url: string (required) }";

    /* Vector search */
    case "vectorFileSearch":
      return `{ query: string (required), maxResults?: number, vectorStoreIds: [${vectorStoreIds
        .map((id) => `"${id}"`)
        .join(", ")}] (required) }`;

    /* Passport */
    case "createPassport":
      return "{ passport_number: string, surname: string, given_names: string, nationality: string, date_of_birth: string (YYYY-MM-DD), sex: string, place_of_birth: string, date_of_issue: string, date_of_expiry: string, issuing_authority: string, holder_signature_present: boolean, type: string, residence?: string, height_cm?: number, eye_color?: string }";
    case "getPassports":
      return "{ passport_number?: string, surname?: string, given_names?: string /* etc. */ }";
    case "updatePassport":
      return "{ id: number (required), /* fields to update */ }";
    case "deletePassport":
      return "{ id: number (required) }";
    case "setupPassportSchema":
      return "{}";

    /* Synthesis */
    case "synthesizeFinalAnswer":
      return "{ userMessage: string, chatHistory: array, toolCalls: array, previousSteps: array, model: string, stepId: number }";

    default:
      return "See tool schema for detailed parameters";
  }
}

/* ------------------------------------------------------------------ */
/* CALL_TOOLS PARSER                                                  */
/* ------------------------------------------------------------------ */
export function parseToolDecisions(
  content: string
): Array<{ name: string; parameters: Record<string, unknown> }> {
  const blockRegex =
    /CALL_TOOLS\s*:?\s*(?:```json)?\s*(\[[\s\S]*?])\s*(?:```)?/i;
  const match = content.match(blockRegex);
  if (!match) return [];

  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* CONTEXT BUILDING                                                   */
/* ------------------------------------------------------------------ */
export function buildUpdatedContext(
  userMessage: string,
  toolCalls: ToolExecution[]
): string {
  const calls = toolCalls
    .map(
      (c) =>
        `\n---\nTool: ${c.tool}\nSuccess: ${c.result.success}\nResult: ${
          typeof c.result.data === "object"
            ? JSON.stringify(c.result.data, null, 2)
            : c.result.data
        }`
    )
    .join("");
  return `USER:\n${userMessage}${calls}`;
}

/* ------------------------------------------------------------------ */
/* EVALUATION PARSER                                                  */
/* ------------------------------------------------------------------ */
export function needsMoreInformation(evalContent: string): boolean {
  return /CONTINUE/i.test(evalContent);
}

/* ------------------------------------------------------------------ */
/* QUICK HEURISTICS                                                   */
/* ------------------------------------------------------------------ */
export function isCalendarQuery(userMessage: string): boolean {
  return /(calendar|meeting|event|schedule|appointment)/i.test(userMessage);
}

/* ------------------------------------------------------------------ */
/* FORMATTING HELPERS                                                 */
/* ------------------------------------------------------------------ */
export function formatChatHistory(history: ChatHistory): string {
  return history
    .map(
      (m) =>
        `- [${new Date(m.timestamp).toISOString()}] ${m.type.toUpperCase()}: ${
          m.content
        }`
    )
    .join("\n");
}

export function formatInternalConversation(
  conversation: Array<{ role: "user" | "assistant"; content: string }>
): string {
  return (
    "\n**INTERNAL CONVERSATION**\n" +
    conversation
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n")
  );
}
