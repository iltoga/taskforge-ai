import { ToolExecution, ToolResult } from "@/tools/tool-registry";
import { ChatHistory } from "@/types/chat";

/* ------------------------------------------------------------------ */
/* TOOL OUTPUT FORMATTING HELPERS                                     */
/* ------------------------------------------------------------------ */

/**
 * Converts a tool result into a standardized chat history entry.
 * This ensures consistent formatting of tool outputs for LLM consumption.
 */
export function formatToolResultForChat(
  toolName: string,
  result: ToolResult,
  parameters?: Record<string, unknown>
): string {
  const paramSummary = parameters
    ? `\nParameters: ${JSON.stringify(parameters, null, 2)}`
    : "";

  if (result.success) {
    let dataSection = "";
    if (result.data) {
      // Format data based on type for better readability
      if (typeof result.data === "string") {
        dataSection = `\nResult: ${result.data}`;
      } else if (Array.isArray(result.data)) {
        dataSection = `\nResult: Found ${result.data.length} items`;
        // Include first few items for context if array is not too large
        if (result.data.length <= 3) {
          dataSection += `\n${JSON.stringify(result.data, null, 2)}`;
        } else {
          dataSection += `\nFirst item: ${JSON.stringify(
            result.data[0],
            null,
            2
          )}`;
        }
      } else {
        dataSection = `\nResult: ${JSON.stringify(result.data, null, 2)}`;
      }
    }

    const messageSection = result.message ? `\nMessage: ${result.message}` : "";

    return `✅ Tool ${toolName} completed successfully${paramSummary}${dataSection}${messageSection}`;
  } else {
    const errorSection = result.error ? `\nError: ${result.error}` : "";
    const messageSection = result.message ? `\nMessage: ${result.message}` : "";

    return `❌ Tool ${toolName} failed${paramSummary}${errorSection}${messageSection}`;
  }
}

/**
 * Creates a summary of tool execution suitable for context injection.
 * This provides a concise overview without overwhelming the LLM with too much detail.
 */
export function createToolExecutionSummary(execution: ToolExecution): string {
  const duration = `(${execution.duration}ms)`;
  const result = execution.result;

  if (result.success) {
    let summary = `${execution.tool} succeeded ${duration}`;
    if (result.message) {
      summary += `: ${result.message}`;
    } else if (result.data) {
      // Provide brief data summary
      if (typeof result.data === "string") {
        summary += `: ${result.data.slice(0, 100)}${
          result.data.length > 100 ? "..." : ""
        }`;
      } else if (Array.isArray(result.data)) {
        summary += `: Found ${result.data.length} items`;
      } else {
        summary += `: Data available`;
      }
    }
    return summary;
  } else {
    let summary = `${execution.tool} failed ${duration}`;
    if (result.message) {
      summary += `: ${result.message}`;
    } else if (result.error) {
      summary += `: ${result.error}`;
    }
    return summary;
  }
}

/**
 * Determines if a tool result should be included in the conversation history.
 * This helps avoid duplicate context injection.
 */
export function shouldInjectToolResult(
  toolName: string,
  result: ToolResult,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): boolean {
  // Don't inject if the result is already in recent conversation history
  const recentMessages = conversationHistory.slice(-3);
  const toolMentions = recentMessages.filter(
    (msg) =>
      msg.content.includes(toolName) &&
      (msg.content.includes("succeeded") || msg.content.includes("failed"))
  );

  // If tool was already mentioned in recent conversation, don't inject again
  if (toolMentions.length > 0) {
    return false;
  }

  // Always inject for synthesis tools as they provide important context
  if (toolName.includes("synthesize")) {
    return true;
  }

  // Inject if the result has meaningful content
  return result.success
    ? !!(result.data || result.message)
    : !!(result.error || result.message);
}

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

    /* Vector search */
    case "vectorFileSearch":
      return `{ query: string (required), maxResults?: number, vectorStoreIds: [${vectorStoreIds
        .map((id) => `"${id}"`)
        .join(", ")}] (required) }`;

    /* File search */
    case "searchFiles":
      return "{ query: string (required) - natural language query to search uploaded files }";
    case "getDocumentByName":
      return "{ name: string (required) - exact filename with extension }";
    case "cleanupFiles":
      return "{ deleteDiskFiles?: boolean }";

    /* Passport */
    case "createPassport":
      return "{ passport_number: string, surname: string (translated in english), given_names: string (translated in english), nationality: string (translated in english), date_of_birth: string (YYYY-MM-DD), sex: string, place_of_birth: string (translated in english), date_of_issue: string, date_of_expiry: string, issuing_authority: string (translated in english), holder_signature_present: boolean, type: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "getPassports":
      return "{ id?: number, passport_number?: string, surname?: string (translated in english), given_names?: string (translated in english), nationality?: string (translated in english), date_of_birth?: string (YYYY-MM-DD), sex?: string, place_of_birth?: string (translated in english), date_of_issue?: string, date_of_expiry?: string, issuing_authority?: string (translated in english), holder_signature_present?: boolean, type?: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "updatePassport":
      return "{ id: number (required), passport_number?: string, surname?: string (translated in english), given_names?: string (translated in english), nationality?: string (translated in english), date_of_birth?: string (YYYY-MM-DD), sex?: string, place_of_birth?: string (translated in english), date_of_issue?: string, date_of_expiry?: string, issuing_authority?: string (translated in english), holder_signature_present?: boolean, type?: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "deletePassport":
      return "{ id: number (required) }";
    case "getDocumentByName":
      return "{ name: string (required, complete file name) }";

    /* Synthesis */

    case "synthesizeFinalAnswer":
      return "{ userMessage: string, chatHistory: array, toolCalls: array, previousSteps: array, model: string, stepId: number }";
    case "synthesizeChat":
      return "{ userMessage: string, chatHistory: array, toolCalls: array, previousSteps: array, model: string, stepId: number }";

    default:
      return "See tool schema for detailed parameters";
  }
}

/* ------------------------------------------------------------------ */
/* COMPACT PARAMETER INFO (OPTIMIZED)                                */
/* ------------------------------------------------------------------ */

/**
 * Ultra-compact parameter descriptions to reduce prompt size.
 */
export function getCompactToolParameterInfo(toolName: string): string {
  switch (toolName) {
    case "getEvents":
    case "searchEvents":
      return "{query?, timeRange?}";
    case "createEvent":
      return "{eventData: {summary, start, end, ...}}";
    case "updateEvent":
      return "{eventId, changes}";
    case "deleteEvent":
      return "{eventId}";
    case "vectorFileSearch":
      return "{query, vectorStoreIds[]}";
    case "searchFiles":
      return "{query}";
    case "getDocumentByName":
      return "{name}";
    case "createPassport":
    case "updatePassport":
      return "{passport_number, surname, given_names, nationality, date_of_birth, ...}";
    case "getPassports":
      return "{id?, passport_number?, surname?, ...}";
    case "deletePassport":
      return "{id}";
    case "synthesizeChat":
    case "synthesizeFinalAnswer":
      return "{userMessage, chatHistory, toolCalls, ...}";
    default:
      return "{...}";
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
    .map((c) => {
      const summary = createToolExecutionSummary(c);
      const detailedResult = formatToolResultForChat(
        c.tool,
        c.result,
        c.parameters
      );
      return `\n---\n${detailedResult}\nSummary: ${summary}`;
    })
    .join("");
  return `USER:\n${userMessage}${calls}`;
}

/**
 * Enhanced context builder that formats tool outputs for better LLM consumption.
 * This version provides both detailed and summary information about tool executions.
 */
export function buildEnhancedContext(
  userMessage: string,
  toolCalls: ToolExecution[],
  chatHistory?: ChatHistory
): string {
  let context = `USER REQUEST:\n${userMessage}\n`;

  if (chatHistory && chatHistory.length > 0) {
    context += `\nCHAT HISTORY:\n${formatChatHistory(chatHistory)}\n`;
  }

  if (toolCalls.length > 0) {
    context += `\nTOOL EXECUTIONS:\n`;
    toolCalls.forEach((call, index) => {
      context += `\n[${index + 1}] ${formatToolResultForChat(
        call.tool,
        call.result,
        call.parameters
      )}\n`;
    });

    context += `\nTOOL EXECUTION SUMMARY:\n`;
    toolCalls.forEach((call, index) => {
      context += `${index + 1}. ${createToolExecutionSummary(call)}\n`;
    });
  }

  return context;
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
