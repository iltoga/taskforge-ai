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
  const hasParams = parameters && Object.keys(parameters).length > 0;
  const paramSummary = hasParams
    ? `\nParameters: ${JSON.stringify(parameters, null, 2)}`
    : "";

  if (result.success) {
    let dataSection = "";
    if (result.data !== undefined && result.data !== null) {
      if (typeof result.data === "string") {
        dataSection = `\nResult: ${result.data}`;
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
  // Always inject for synthesis tools as they provide important context
  if (toolName.includes("synthesize")) {
    return true;
  }
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
      return "{ eventData: { summary: string (required), description?: string, start: { dateTime?: string (ISO with timezone) | date?: string (YYYY-MM-DD) }, end: { dateTime?: string (ISO with same type) | date?: string (YYYY-MM-DD next day for all‑day) }, location?: string, attendees?: [{ email: string, displayName?: string }], reminders?: [{ minutes: number, method?: string }] }  RULES: start & end must BOTH use date OR BOTH use dateTime; if time explicitly given (e.g. '9 am'), use dateTime with 1h default duration; if no time, use all‑day start.date + end.date = start + 1 day. Include timezone offset (e.g. +02:00) or 'Z'.";
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
    case "getDocumentByNameFromDb":
      return "{ name: string (required) - exact filename with extension }";

    /* MCP Filesystem (common tool names) */
    case "list_directory":
      return "{ path: string (absolute or repo-relative), recursive?: boolean }";
    case "list_directory_with_sizes":
      return "{ path: string (absolute or repo-relative), sortBy?: 'name' | 'size' }";
    case "directory_tree":
      return "{ path: string (absolute or repo-relative) }";
    case "read_file":
      return "{ path: string (absolute or repo-relative) }";
    case "read_text_file":
      return "{ path: string (absolute or repo-relative), encoding?: string }";
    case "read_media_file":
      return "{ path: string (absolute or repo-relative) }";
    case "read_multiple_files":
      return "{ paths: string[] (absolute or repo-relative) }";
    case "write_file":
      return "{ path: string (absolute or repo-relative), content: string }";
    case "edit_file":
      return "{ path: string (absolute or repo-relative), edits: Array<{oldText: string, newText: string}> }";
    case "create_directory":
      return "{ path: string (absolute or repo-relative) }";
    case "move_file":
      return "{ source: string (absolute or repo-relative), destination: string (absolute or repo-relative) }";
    case "search_files":
      return "{ path: string (absolute or repo-relative), pattern: string, excludePatterns?: string[] }";
    case "get_file_info":
      return "{ path: string (absolute or repo-relative) }";
    case "list_allowed_directories":
      return "{ }";

    /* MCP Git */
    case "git_status":
      return "{ repo_path: string }";
    case "git_diff_unstaged":
      return "{ repo_path: string, context_lines?: number }";
    case "git_diff_staged":
      return "{ repo_path: string, context_lines?: number }";
    case "git_diff":
      return "{ repo_path: string, target: string, context_lines?: number }";
    case "git_commit":
      return "{ repo_path: string, message: string }";
    case "git_add":
      return "{ repo_path: string, files: string[] }";
    case "git_reset":
      return "{ repo_path: string }";
    case "git_log":
      return "{ repo_path: string, max_count?: number }";
    case "git_create_branch":
      return "{ repo_path: string, branch_name: string, base_branch?: string }";
    case "git_checkout":
      return "{ repo_path: string, branch_name: string }";
    case "git_show":
      return "{ repo_path: string, revision: string }";
    case "git_init":
      return "{ repo_path: string }";
    case "git_branch":
      return "{ repo_path: string, branch_type: 'local' | 'remote' | 'all', contains?: string, not_contains?: string }";

    /* Passport */
    case "createPassport":
      return "{ passport_number: string, surname: string (translated in english), given_names: string (translated in english), nationality: string (translated in english), date_of_birth: string (YYYY-MM-DD), sex: string, place_of_birth: string (translated in english), date_of_issue: string, date_of_expiry: string, issuing_authority: string (translated in english), holder_signature_present: boolean, type: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "getPassports":
      return "{ id?: number, passport_number?: string, surname?: string (translated in english), given_names?: string (translated in english), nationality?: string (translated in english), date_of_birth?: string (YYYY-MM-DD), sex?: string, place_of_birth?: string (translated in english), date_of_issue?: string, date_of_expiry?: string, issuing_authority?: string (translated in english), holder_signature_present?: boolean, type?: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "updatePassport":
      return "{ id: number (required), passport_number?: string, surname?: string (translated in english), given_names?: string (translated in english), nationality?: string (translated in english), date_of_birth?: string (YYYY-MM-DD), sex?: string, place_of_birth?: string (translated in english), date_of_issue?: string, date_of_expiry?: string, issuing_authority?: string (translated in english), holder_signature_present?: boolean, type?: string, residence?: string (translated in english), height_cm?: number, eye_color?: string, documentId?: number (id of the uploaded file. add only if available) }";
    case "deletePassport":
      return "{ id: number (required) }";
    case "getDocumentByNameFromDb":
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
      return "{eventData:{summary, start{date|dateTime}, end{same type}, tz, ...}}";
    case "updateEvent":
      return "{eventId, changes}";
    case "deleteEvent":
      return "{eventId}";
    case "vectorFileSearch":
      return "{query, vectorStoreIds[]}";
    case "searchFiles":
      return "{query}";
    case "getDocumentByNameFromDb":
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
  // 1) Try to find a CALL_TOOLS block with optional code fences
  const blockRegex =
    /CALL_TOOLS\s*:?\s*(?:```json|```)?\s*(\[[\s\S]*?])\s*(?:```)?/i;
  const match = content.match(blockRegex);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      // fall through
    }
  }
  // 2) If content itself is a JSON array, parse directly
  const trimmed = content.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* PLAN JSON PARSERS (robust)                                         */
/* ------------------------------------------------------------------ */
/**
 * Try to extract a JSON array from arbitrary text. Looks for:
 * - fenced code blocks ```json [ ... ] ```
 * - the first top-level [ ... ] sequence
 * - PLAN_JSON sections
 */
export function extractJsonArrayFromText(text: string): unknown[] | null {
  if (!text) return null;

  // 1) Fenced code blocks labelled json
  const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
  let m = codeBlockRegex.exec(text);
  while (m) {
    const candidate = m[1].trim();
    if (candidate.startsWith("[") && candidate.endsWith("]")) {
      try {
        return JSON.parse(candidate);
      } catch {
        // continue
      }
    }
    m = codeBlockRegex.exec(text);
  }

  // 2) PLAN_JSON section
  const planSectionRegex = /PLAN_JSON[\s\S]*?(\[[\s\S]*?\])/i;
  const planMatch = text.match(planSectionRegex);
  if (planMatch) {
    try {
      return JSON.parse(planMatch[1]);
    } catch {
      // fallthrough
    }
  }

  // 3) First array-looking bracket block
  const arrayRegex = /(\[[\s\S]*\])/m; // greedy, but we JSON.parse and fallback on error
  const arrMatch = text.match(arrayRegex);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[1]);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Normalize raw planned calls coming from LLM to a consistent shape.
 */
export function normalizeRawPlanCalls(
  rawItems: unknown[],
  validToolNames: Set<string>
): Array<{ name: string; tool: string; parameters: Record<string, unknown> }> {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      let name = String(obj.name ?? obj.tool ?? "").trim();
      if (!name) return null;
      // Remove category prefixes like "PASSPORT.getPassports"
      if (name.includes(".")) name = name.split(".").pop() as string;
      // Common alias fixups
      if (name === "fileSearchTool") name = "searchFiles";
      // Skip invalid tools
      if (!validToolNames.has(name)) return null;
      const parameters =
        obj.parameters && typeof obj.parameters === "object"
          ? (obj.parameters as Record<string, unknown>)
          : {};
      return { name, tool: name, parameters };
    })
    .filter(Boolean) as Array<{
    name: string;
    tool: string;
    parameters: Record<string, unknown>;
  }>;
}

/**
 * Parse a plan from arbitrary text (e.g., analysis SCRATCHPAD with PLAN_JSON),
 * returning normalized name/tool/parameters tuples.
 */
export function parsePlanFromText(
  text: string,
  validToolNames: Set<string>
): Array<{ name: string; tool: string; parameters: Record<string, unknown> }> {
  // Try CALL_TOOLS first
  const callTools = parseToolDecisions(text);
  if (callTools.length) {
    return normalizeRawPlanCalls(callTools as unknown[], validToolNames);
  }

  // Then generic JSON array extraction
  const arr = extractJsonArrayFromText(text);
  if (arr) {
    return normalizeRawPlanCalls(arr, validToolNames);
  }

  return [];
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
  if (!evalContent) return true;
  const txt = evalContent.toLowerCase();
  // Positive signals to continue
  const continueHints = [
    "continue:",
    "need more information",
    "need more data",
    "insufficient information",
    "not enough information",
  ];
  if (continueHints.some((h) => txt.includes(h))) return true;

  // Negative signals (complete/sufficient)
  const completeHints = [
    "complete:",
    "have sufficient info",
    "enough information",
    "the current data is sufficient",
    "sufficient",
  ];
  if (completeHints.some((h) => txt.includes(h))) return false;

  // Default: do not continue unless explicitly told to
  return false;
}

/* ------------------------------------------------------------------ */
/* QUICK HEURISTICS                                                   */
/* ------------------------------------------------------------------ */
export function isCalendarQuery(userMessage: string): boolean {
  return /(calendar|meeting|event|schedule|appointment)/i.test(userMessage);
}

/* ------------------------------------------------------------------ */
/* READ-ONLY TOOL HEURISTIC                                           */
/* ------------------------------------------------------------------ */
const READ_ONLY_TOOLS = new Set([
  "getPassports",
  "listPassports",
  "searchEvents",
  "getEvents",
  "searchFiles",
  "vectorFileSearch",
  "getDocumentByNameFromDb",
  // MCP filesystem common read-only tools
  "list_directory",
  "read_file",
  "read_text_file",
]);

export function isReadOnlyTool(toolName: string): boolean {
  return READ_ONLY_TOOLS.has(toolName);
}

/* ------------------------------------------------------------------ */
/* FORMATTING HELPERS                                                 */
/* ------------------------------------------------------------------ */
export function formatChatHistory(history: ChatHistory): string {
  if (!history || !Array.isArray(history)) {
    return "";
  }
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
