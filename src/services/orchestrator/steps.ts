import { ModelType } from "@/appconfig/models";
import { generateTextWithProvider } from "@/lib/openai";
import { ToolExecution, ToolRegistry } from "@/tools/tool-registry";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import * as prompts from "./prompts";
import {
  NormalizedPlanCall,
  OrchestrationStep,
  OrchestratorContext,
  PlannedStep,
  RawPlanCall,
} from "./types";
import * as utils from "./utils";

/* internal ---------------------------------------------------------------- */

// Shared utility to reduce duplication between performAnalysis and generatePlan
async function createSharedPlanningContext(
  toolRegistry: ToolRegistry,
  vectorStoreIds: string[],
  processedFiles: ProcessedFile[] = [],
  toolExecutions?: ToolExecution[],
  currentContext?: string
) {
  const categorizedTools = await toolListWithParams(
    toolRegistry,
    vectorStoreIds
  );

  // Create valid tool names set - use async method to include MCP tools
  let allTools: Array<{ name: string }>;
  const maybeAsync = toolRegistry as unknown as {
    getAllAvailableTools?: () => Promise<Array<{ name: string }>>;
  };
  if (typeof maybeAsync.getAllAvailableTools === "function") {
    allTools = await maybeAsync.getAllAvailableTools();
  } else {
    const internal = toolRegistry.getAvailableTools() as unknown as Array<{
      name: string;
    }>;
    allTools = internal;
  }
  const validToolNames: Set<string> = new Set(
    allTools.map((t: { name: string }) => t.name)
  );
  if (vectorStoreIds.length === 0) {
    validToolNames.delete("vectorFileSearch");
  }
  validToolNames.delete("synthesizeFinalAnswer");
  validToolNames.delete("initializeFileSearch"); // Exclude initializeFileSearch as it is not used in planning. it is used programmatically in orchestrate

  // Generate file info (format differs between functions)
  const fileInfoForAnalysis =
    processedFiles.length > 0
      ? `\n\n**FILE CONTEXT INFORMATION**:\n${processedFiles
          .map((f) => {
            let typeDesc = "";
            if (f.isImage) {
              typeDesc = "image file";
            } else if (f.convertedImages && f.convertedImages.length > 0) {
              const imagesPlural = f.convertedImages.length > 1;
              typeDesc = `document file (document has been converted to image${
                imagesPlural ? "s" : ""
              } ${f.convertedImages.join(", ")})`;
            } else {
              typeDesc = "document file";
            }
            return `- ${f.name} (${f.size} bytes, ${typeDesc})`;
          })
          .join("\n")}`
      : "";

  const fileInfoForPlanning =
    processedFiles.length > 0
      ? "\n\n**UPLOADED FILES**:\n" +
        processedFiles
          .map((f, i) => {
            let type = f.isImage ? "image" : "document";
            if (f.processAsImage) {
              type += " (document to be processed as image/s: ";
              if (f.convertedImages && f.convertedImages.length > 0) {
                type += f.convertedImages.join(", ");
              } else {
                type += "no images found";
              }
              type += ")";
            }
            return `  ${i + 1}. ${f.name} (${type})`;
          })
          .join("\n")
      : "";

  // Generate previous tool context
  const previousToolContext =
    toolExecutions && toolExecutions.length > 0
      ? `\n\n**PREVIOUS TOOL EXECUTIONS:**\n${toolExecutions
          .map((exec) => {
            const summary = utils.createToolExecutionSummary(exec);
            return `- ${summary}`;
          })
          .join("\n")}\n\n**CURRENT CONTEXT:**\n${
          currentContext || "No additional context"
        }`
      : "";

  // Provide project root to help MCP filesystem tools avoid placeholder paths
  const projectRoot = process.cwd();

  return {
    categorizedTools,
    validToolNames,
    fileInfoForAnalysis,
    fileInfoForPlanning,
    previousToolContext,
    projectRoot,
  };
}

// async function imagesFromFiles(files: ProcessedFile[]) {
//   return Promise.all(
//     files
//       .filter((f) => f.isImage)
//       .map(async (f) => ({
//         imageData: await uploadedFileToImageDataUrl(f.fileName, f.fileType),
//         mimeType: f.fileType || "image/png",
//       }))
//   );
// }

async function toolListWithParams(reg: ToolRegistry, vectorIds: string[]) {
  // Prefer async all-tools (includes MCP), fallback to sync internal-only
  const maybeAsync = reg as unknown as {
    getAllAvailableTools?: () => Promise<
      Array<{ name: string; description: string; category: string }>
    >;
  };
  const tools: Array<{ name: string; description: string; category: string }> =
    typeof maybeAsync.getAllAvailableTools === "function"
      ? await maybeAsync.getAllAvailableTools()
      : (reg.getAvailableTools() as unknown as Array<{
          name: string;
          description: string;
          category: string;
        }>);

  // Group by category
  const byCategory = new Map<
    string,
    Array<{ name: string; description: string }>
  >();
  for (const t of tools) {
    if (t.name === "synthesizeFinalAnswer") continue; // Exclude from planning
    const list = byCategory.get(t.category) || [];
    list.push({ name: t.name, description: t.description });
    byCategory.set(t.category, list);
  }

  // Build string
  return Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, items]) => {
      const body = items
        .map(
          (t) =>
            `  - ${t.name}: ${
              t.description
            }\n    Parameters: ${utils.getToolParameterInfo(t.name, vectorIds)}`
        )
        .join("\n");
      return body ? `**${cat.toUpperCase()}**:\n${body}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Generates the first draft plan (Plan‑then‑Act paradigm).
 * It asks the LLM for a short JSON array of tool actions.
 * We then convert each action into a `PlannedStep`.
 */

export async function generatePlan(
  ctx: OrchestratorContext,
  userMessage: string,
  toolRegistry: ToolRegistry,
  model: ModelType,
  stepId: number,
  processedFiles: ProcessedFile[] = [],
  currentContext?: string,
  toolExecutions?: ToolExecution[]
): Promise<PlannedStep[]> {
  const {
    categorizedTools,
    validToolNames,
    fileInfoForPlanning: fileInfo,
    previousToolContext,
    projectRoot,
  } = await createSharedPlanningContext(
    toolRegistry,
    ctx.vectorStoreIds,
    processedFiles,
    toolExecutions,
    currentContext
  );

  // 5. Insert fileInfo and context into the prompt after Available tools:
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `
You are a PLANNING AGENT.

CURRENT_DATE: ${currentDate}

User goal: "${userMessage}"
${previousToolContext}

Available tools:
${categorizedTools}
${fileInfo}
PROJECT_ROOT: ${projectRoot}

Create the most efficient, shortest path plan to fulfil the goal.

IMPORTANT: Prefer MCP filesystem tools for repository/local files when available.
- Typical flow: list_directory to discover exact paths, then read_text_file or read_file with the returned path.
- Never invent or guess file paths. Do not use placeholders like "/path/to/file".
- If there are NO uploaded files, do NOT use searchFiles; use MCP filesystem tools instead.
- Only use searchFiles when the user has uploaded files in this session (see UPLOADED FILES section).

IMPORTANT: For file search operations:
- Use "searchFiles" with a "query" parameter (natural language query)
- Never use "files" parameter
- Example: {"tool": "searchFiles", "parameters": {"query": "extract passport details"}}

IMPORTANT: For calendar operations:
- When user says "today", use the current date: ${currentDate}
- When user says "tomorrow", use the next day after current date
- Always include proper time zones (e.g., "+02:00" or "UTC") in dateTime fields
- Example: {"tool": "createEvent", "parameters": {"eventData": {"summary": "Meeting", "start": {"dateTime": "2025-07-17T14:00:00+02:00"}, "end": {"dateTime": "2025-07-17T15:00:00+02:00"}}}}
 - If the user does not specify a time, prefer creating an all-day event using start.date and end.date (next day)

Return **only** valid JSON like:
[
  {
    "goal": "extract data from uploaded files",
    "tool": "searchFiles",
    "parameters": { "query": "extract passport details including passport number name nationality date of birth expiry date" }
  },
  {
    "goal": "create passport record",
    "tool": "createPassport",
    "parameters": { "passport_number": "extracted_value", "surname": "extracted_value", ... }
  }
]
`;

  ctx.log(`🟦 [generatePlan] Prompt sent to LLM:\n${prompt}`);
  const llm = await generateTextWithProvider(prompt, ctx.getAIConfig(model), {
    model,
    max_tokens: 2048, // Increased from 512 to allow for complete plan generation
  });
  ctx.log(`🟦 [generatePlan] LLM response:\n${llm?.text}`);

  // Primary parse path: CALL_TOOLS JSON blocks
  let plannedCalls: RawPlanCall[] =
    utils.parseToolDecisions(llm?.text ?? "") || [];

  // If the LLM returned raw JSON (no CALL_TOOLS wrapper) parse it.
  if (plannedCalls.length === 0) {
    try {
      plannedCalls = JSON.parse(llm?.text ?? "[]");
    } catch {
      // Try robust PLAN_JSON/array extraction
      const arr = utils.extractJsonArrayFromText(llm?.text ?? "");
      plannedCalls = (Array.isArray(arr) ? arr : []) as RawPlanCall[];
    }
  }

  // 5. Normalise plan calls using validToolNames
  const normalizedCalls: NormalizedPlanCall[] = plannedCalls
    .map((raw: RawPlanCall) => {
      // resolve the requested tool name
      let requested = raw.name ?? raw.tool ?? "";
      if (requested.includes(".")) requested = requested.split(".").pop()!;

      // ignore invalid tool names
      if (!validToolNames.has(requested)) return null;

      return {
        name: requested,
        tool: requested,
        parameters: raw.parameters ?? {},
        reasoning: raw.reasoning,
      };
    })
    .filter(Boolean) as NormalizedPlanCall[];
  // Ensure searchFiles is first when there are uploaded files
  // if (
  //   processedFiles.length > 0 &&
  //   !normalizedCalls.some((c) => c.tool === "searchFiles")
  // ) {
  //   normalizedCalls.unshift({
  //     name: "searchFiles",
  //     tool: "searchFiles",
  //     parameters: {
  //       query: "extract all relevant data and information from uploaded files",
  //     },
  //     reasoning: "Need to extract data from uploaded files/images",
  //   });
  // }

  const res = normalizedCalls.map((raw, idx) => {
    const toolName =
      raw.tool ||
      raw.name ||
      (toolRegistry.getAvailableTools()[0]?.name ?? "undefined");

    return {
      id: `plan_${stepId}_${idx}`,
      goal:
        typeof raw.reasoning === "string" && raw.reasoning.trim().length > 2
          ? raw.reasoning
          : toolName,
      tool: toolName,
      parameters: raw.parameters ?? {},
    } as PlannedStep;
  });
  ctx.log(`🗺️ Planned steps:\n${JSON.stringify(res, null, 2)}`);
  // Fallback: if still empty, construct a minimal heuristic plan
  if (!res.length) {
    ctx.log(
      "📉 Planner produced no steps – attempting heuristic fallback plan"
    );
    const tools = new Set(toolRegistry.getAvailableTools().map((t) => t.name));
    const steps: PlannedStep[] = [];

    // Heuristic: if message mentions passport and calendar
    const mentionsPassport = /passport/i.test(userMessage);
    const mentionsCalendar =
      /(calendar|meeting|event|schedule|appointment)/i.test(userMessage);
    if (mentionsPassport && tools.has("getPassports")) {
      steps.push({
        id: `plan_${stepId}_0`,
        goal: "Find passport by provided filters (surname/given_names if present)",
        tool: "getPassports",
        parameters: {},
      });
    }
    if (mentionsCalendar && tools.has("createEvent")) {
      // Attempt lightweight natural language extraction for common patterns like
      // "next week, tuesday at 9 am" or "tomorrow" to avoid empty event payloads.
      const lowered = userMessage.toLowerCase();
      const now = new Date();
      const weekdayMap = new Map([
        ["sunday", 0],
        ["monday", 1],
        ["tuesday", 2],
        ["wednesday", 3],
        ["thursday", 4],
        ["friday", 5],
        ["saturday", 6],
      ]);
      function nextWeekday(targetDow: number): Date {
        const d = new Date(now);
        const currentDow = d.getDay();
        let delta = (targetDow - currentDow + 7) % 7;
        if (delta === 0) delta = 7; // next occurrence
        // If phrase includes 'next week' and delta < 7, push a full week
        if (/next week/.test(lowered)) delta += 7;
        d.setDate(d.getDate() + delta);
        return d;
      }
      let startDate: Date | undefined;
      for (const [name, dow] of weekdayMap.entries()) {
        if (lowered.includes(name)) {
          startDate = nextWeekday(dow);
          break;
        }
      }
      if (!startDate && /tomorrow/.test(lowered)) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() + 1);
      }
      if (!startDate && /today/.test(lowered)) {
        startDate = new Date(now);
      }
      // Default: if still unknown but user mentions 'next week', choose 7 days ahead
      if (!startDate && /next week/.test(lowered)) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() + 7);
      }

      // Time extraction (simple): look for '9 am', '14:30', etc.
      let explicitTime = false;
      let hour = 9;
      let minute = 0;
      const timeMatch = lowered.match(/(\b\d{1,2})(?::(\d{2}))?\s?(am|pm)?/);
      if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const mer = timeMatch[3];
        if (mer === "pm" && h < 12) h += 12;
        if (mer === "am" && h === 12) h = 0;
        hour = h;
        minute = m;
        explicitTime = true;
      } else if (/morning/.test(lowered)) {
        hour = 9;
        explicitTime = true;
      } else if (/afternoon/.test(lowered)) {
        hour = 14;
        explicitTime = true;
      } else if (/evening/.test(lowered)) {
        hour = 18;
        explicitTime = true;
      }

      // Derive a tentative summary from the user message in a GENERIC way (no domain hard‑coding)
      // 1. Attempt to capture a name pattern after "for <First> <Last>"
      let guessedName = "";
      const nameMatch = userMessage.match(
        /for\s+([A-Z]?[a-z]+)\s+([A-Z]?[a-z]+)/i
      );
      if (nameMatch) {
        const part1 = nameMatch[1];
        const part2 = nameMatch[2];
        guessedName = `${part1.charAt(0).toUpperCase()}${part1.slice(1)} ${part2
          .charAt(0)
          .toUpperCase()}${part2.slice(1)}`;
      }

      // 2. Generic action phrase extraction: common initiating verbs followed by up to 3 words (non‑stopwords)
      let actionPhrase = "Event";
      const verbPattern =
        /(start|begin|kickoff|submit|review|plan|create|schedule)\s+([^\.]{0,60})/i;
      const actionMatch = userMessage.match(verbPattern);
      if (actionMatch) {
        // Clean trailing punctuation and limit to a few words (avoid entire sentence)
        const rawTail = actionMatch[2]
          .replace(/\s+/g, " ")
          .trim()
          .replace(/[.,;:!?].*$/, "");
        const words = rawTail.split(/\s+/).filter(Boolean).slice(0, 3); // up to 3 words
        const base = [actionMatch[1], ...words]
          .join(" ")
          .replace(/\b(\w)/g, (c) => c.toUpperCase());
        actionPhrase = base;
      }

      const defaultSummary = guessedName
        ? `${actionPhrase} — ${guessedName}`
        : actionPhrase;
      const eventData: Record<string, unknown> = { summary: defaultSummary };
      if (startDate) {
        if (explicitTime) {
          const startDT = new Date(startDate);
          startDT.setHours(hour, minute, 0, 0);
          const endDT = new Date(startDT.getTime() + 60 * 60 * 1000); // default 1h
          const iso = (d: Date) => d.toISOString();
          eventData.start = { dateTime: iso(startDT) };
          eventData.end = { dateTime: iso(endDT) };
        } else {
          // all‑day
          const yyyyMmDd = startDate.toISOString().slice(0, 10);
          const nextDay = new Date(startDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const yyyyMmDd2 = nextDay.toISOString().slice(0, 10);
          eventData.start = { date: yyyyMmDd };
          eventData.end = { date: yyyyMmDd2 };
        }
      } else {
        eventData.start = {};
        eventData.end = {};
      }

      steps.push({
        id: `plan_${stepId}_1`,
        goal: "Create or update calendar event as requested",
        tool: "createEvent",
        parameters: { eventData },
      });
    }

    // If we built any heuristic steps, return them
    if (steps.length) {
      ctx.log(`🧭 Heuristic steps used:\n${JSON.stringify(steps, null, 2)}`);
      return steps;
    }

    // Last resort: if knowledge tool exists and message looks like a question
    if (tools.has("vectorFileSearch") && /\?$/.test(userMessage)) {
      return [
        {
          id: `plan_${stepId}_0`,
          goal: "Search knowledge base for answer",
          tool: "vectorFileSearch",
          parameters: {
            query: userMessage,
            vectorStoreIds: ctx.vectorStoreIds,
          },
        },
      ];
    }

    return [];
  }
  return res;
}

/* === PHASE 1 OPTIMIZATION: COMBINED ANALYZE + PLAN ================== */
/**
 * analyzeAndPlan: merges performAnalysis + generatePlan into a single LLM call
 * to save one round‑trip. Returns both an analysis step (for logs) and the
 * parsed planned steps. Falls back silently to empty array if parsing fails.
 */
export async function analyzeAndPlan(
  ctx: OrchestratorContext,
  userMessage: string,
  toolRegistry: ToolRegistry,
  model: ModelType,
  stepId: number,
  processedFiles: ProcessedFile[] = [],
  currentContext?: string,
  previousToolExecutions?: ToolExecution[]
): Promise<{ analysisContent: string; planned: PlannedStep[] }> {
  const {
    categorizedTools,
    validToolNames,
    fileInfoForPlanning: fileInfo,
    previousToolContext,
    projectRoot,
  } = await createSharedPlanningContext(
    toolRegistry,
    ctx.vectorStoreIds,
    processedFiles,
    previousToolExecutions,
    currentContext
  );

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ultra‑compact tool list: name + category only (include MCP tools via async registry when available)
  let toolsForList: Array<{ name: string; category?: string }>;
  const maybeAsyncTools = toolRegistry as unknown as {
    getAllAvailableTools?: () => Promise<
      Array<{ name: string; category?: string }>
    >;
  };
  if (typeof maybeAsyncTools.getAllAvailableTools === "function") {
    toolsForList = await maybeAsyncTools.getAllAvailableTools();
  } else {
    toolsForList = toolRegistry.getAvailableTools() as unknown as Array<{
      name: string;
      category?: string;
    }>;
  }
  const toolList = toolsForList
    .map(
      (t: { name: string; category?: string }) =>
        `${t.name}:${t.category ?? "uncategorized"}`
    )
    .join(", ");

  const prompt = `ROLE: AnalyzeAndPlanGPT
DATE: ${currentDate}
USER: "${userMessage}"
CONTEXT: ${previousToolContext || "(none)"}
FILES: ${fileInfo || "(none)"}
TOOLS: ${toolList}
TOOLS_BY_CATEGORY:\n${categorizedTools}
RULES:
- Output one JSON plan only (no prose outside sections below)
- Each step exactly one tool; max 6 steps
- If user did not specify time for calendar actions → use all‑day (start.date + end.date next day)
- Get identifiers (e.g. getPassports/searchEvents) before create/update/delete
- If no tool can satisfy request → return PLAN_JSON = [] and note reason in SCRATCHPAD
 - Prefer MCP filesystem tools (list_directory, read_text_file/read_file) for repository/local file access; avoid searchFiles unless there are uploaded files
 - Never use placeholder paths; always pass exact paths returned by prior steps
 - Anchor filesystem paths to PROJECT_ROOT when exploring repository files
PROJECT_ROOT: ${projectRoot}
FORMAT:
### SCRATCHPAD\n<brief reasoning bullets>\n\n### PLAN_JSON\n[ ... ]\n\n### SELF_CHECK\n<OK or issues>
Return the sections exactly.
`;

  ctx.log(`🟦 [analyzeAndPlan] Prompt sent to LLM:\n${prompt}`);
  const llm = await generateTextWithProvider(prompt, ctx.getAIConfig(model), {
    model,
    max_tokens: 800,
  });
  const text = llm?.text || "";
  ctx.log(`🟩 [analyzeAndPlan] LLM response:\n${text}`);

  // Parse steps using existing robust parser
  const parsed = utils.parsePlanFromText(text, validToolNames);
  const planned: PlannedStep[] = parsed.map((p, idx) => ({
    id: `plan_${stepId}_${idx}`,
    goal: p.tool,
    tool: p.tool,
    parameters: p.parameters,
  }));

  return { analysisContent: text, planned };
}

/* === ANALYSIS ========================================================= */
/**
 * @deprecated performAnalysis is deprecated and may be removed in future releases.
 * Use analyzeAndPlan for combined analysis and planning.
 */
export async function performAnalysis(
  ctx: OrchestratorContext,
  userMessage: string,
  chatHistory: ChatHistory,
  toolRegistry: ToolRegistry,
  model: ModelType,
  stepId: number,
  processedFiles: ProcessedFile[] = []
): Promise<OrchestrationStep> {
  const { fileInfoForAnalysis } = await createSharedPlanningContext(
    toolRegistry,
    ctx.vectorStoreIds,
    processedFiles
  );

  const plannerPrompt = prompts.buildCompactPlannerPrompt(
    utils.formatChatHistory(chatHistory),
    userMessage,
    fileInfoForAnalysis,
    toolRegistry
  );

  ctx.log(`🟦 [performAnalysis] Prompt sent to LLM:\n${plannerPrompt}`);
  const response = await generateTextWithProvider(
    plannerPrompt,
    ctx.getAIConfig(model),
    {
      model,
      // TODO: remove this after testing (images are not used in analysis, otherwise file search will be used during analysis)
      // images: processedFiles.length
      //   ? await imagesFromFiles(processedFiles)
      //   : undefined,
    }
  );
  ctx.log(`� [performAnalysis] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "analysis",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Initial analysis and planning",
  };
}

/* === TOOL DECISION ==================================================== */
export async function decideToolUsage(
  ctx: OrchestratorContext,
  context: string,
  toolRegistry: ToolRegistry,
  previousToolCalls: ToolExecution[],
  previousSteps: OrchestrationStep[],
  model: ModelType,
  stepId: number,
  internalConv: Array<{ role: "user" | "assistant"; content: string }> = [],
  processedFiles: ProcessedFile[] = []
): Promise<OrchestrationStep> {
  const categorizedTools = await toolListWithParams(
    toolRegistry,
    ctx.vectorStoreIds
  );

  const prevCalls =
    previousToolCalls.length > 0
      ? `\nPrevious tool calls:\n${previousToolCalls
          .map(
            (c) =>
              `- ${c.tool} -> ${c.result.success ? "SUCCESS" : "FAIL"} (${
                c.duration
              }ms)`
          )
          .join("\n")}`
      : "";

  const prevSteps =
    previousSteps.length > 0
      ? `\nPrevious steps:\n${previousSteps
          .map((s) => `[${s.id}] ${s.type.toUpperCase()}`)
          .join(" → ")}`
      : "";

  const prompt = `
You are planning the **NEXT TOOL ACTION**.

## USER CONTEXT
${context}${prevCalls}${prevSteps}
${internalConv.length ? utils.formatInternalConversation(internalConv) : ""}

## FILES
${
  processedFiles.length
    ? processedFiles.map((f) => `- ${f.name}`).join("\n")
    : "None"
}

## TOOLS
${categorizedTools}

${prompts.generateDecisionRules(toolRegistry)}
${prompts.generatePriorityOrder(toolRegistry)}


Respond with either CALL_TOOLS json array or SUFFICIENT_INFO message exactly as specified.
`;

  ctx.log(`🟦 [decideToolUsage] Prompt sent to LLM:\n${prompt}`);
  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      // images: processedFiles.length
      //   ? await imagesFromFiles(processedFiles)
      //   : undefined,
    }
  );
  ctx.log(`🟩 [decideToolUsage] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "evaluation",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Planned next tool usage",
  };
}

/* === PROGRESS EVALUATION ============================================= */
export async function evaluateProgress(
  ctx: OrchestratorContext,
  originalMsg: string,
  currentContext: string,
  toolCalls: ToolExecution[],
  prevSteps: OrchestrationStep[],
  model: ModelType,
  stepId: number,
  internalConv: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<OrchestrationStep> {
  // Use enhanced tool result formatting for better evaluation
  const toolResults = toolCalls
    .map((c) => {
      const summary = utils.createToolExecutionSummary(c);
      const formatted = utils.formatToolResultForChat(
        c.tool,
        c.result,
        c.parameters
      );
      return `## ${c.tool} ${
        c.result.success ? "✅" : "❌"
      }\n${summary}\n\nDetailed Output:\n${formatted}`;
    })
    .join("\n\n");

  ctx.log(
    `📊 Evaluating progress with ${toolCalls.length} tool executions and ${prevSteps.length} steps`
  );

  const prompt = `
## PROGRESS CHECK

User asked: "${originalMsg}"
Current context: "${currentContext}"

Tool outcomes:
${toolResults}

Steps so far: ${prevSteps.length}
${internalConv.length ? utils.formatInternalConversation(internalConv) : ""}

IMPORTANT: Analyze if the user's original request has been FULLY completed:
- If user asked to "add X to database" - has X actually been saved to the database?
- If user asked to "create Y" - has Y actually been created?
- If user asked to "update Z" - has Z actually been updated?

Do NOT consider the task complete just because data was extracted or analyzed.
The user's action request must be fully executed.

Should we CONTINUE to fully complete the user's request or is it COMPLETE?
Respond with \`CONTINUE:\` or \`COMPLETE:\` and your reasoning.
`;

  ctx.log(`🟦 [evaluateProgress] Prompt sent to LLM:\n${prompt}`);
  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
    }
  );
  ctx.log(`🟩 [evaluateProgress] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "evaluation",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Determined whether more info needed",
  };
}

/* === RESPONSE VALIDATION ============================================= */
export async function validateResponseFormat(
  ctx: OrchestratorContext,
  userMessage: string,
  synthesized: string,
  model: ModelType,
  stepId: number
): Promise<OrchestrationStep> {
  const prompt = `
## FORMAT VALIDATION
User request: "${userMessage}"

Response draft:
${synthesized}

Does this match user's intent and required format?
Reply with either:
\`\`\`
FORMAT_ACCEPTABLE: ok
\`\`\`
or
\`\`\`
FORMAT_NEEDS_REFINEMENT: explanation...
\`\`\`
`;

  ctx.log(`🟦 [validateResponseFormat] Prompt sent to LLM:\n${prompt}`);
  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
    }
  );
  ctx.log(`🟩 [validateResponseFormat] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "evaluation",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Checked final format compliance",
  };
}

/* === REFINEMENT LOOP ================================================== */
export async function refineSynthesis(
  ctx: OrchestratorContext,
  userMessage: string,
  chatHistory: ChatHistory,
  currentContext: string,
  toolCalls: ToolExecution[],
  prevSteps: OrchestrationStep[],
  prevSynth: string,
  feedback: string,
  model: ModelType,
  stepId: number
): Promise<OrchestrationStep> {
  const prompt = `
## REFINE RESPONSE

User: "${userMessage}"

Feedback that needs fixing:
${feedback}

Previous draft:
${prevSynth}

Tool data available:
${toolCalls
  .map((c) => `- ${c.tool}: ${c.result.success ? "OK" : "FAIL"}`)
  .join("\n")}

Chat context:
${utils.formatChatHistory(chatHistory)}

Produce improved final answer.
`;

  ctx.log(`🟦 [refineSynthesis] Prompt sent to LLM:\n${prompt}`);
  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
    }
  );
  ctx.log(`🟩 [refineSynthesis] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "synthesis",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Refined synthesis based on feedback",
  };
}

/* === FINAL SYNTHESIS ================================================== */
export async function synthesizeFinalResponse(
  ctx: OrchestratorContext,
  userMessage: string,
  chatHistory: ChatHistory,
  toolCalls: ToolExecution[],
  prevSteps: OrchestrationStep[],
  model: ModelType,
  stepId: number
): Promise<OrchestrationStep> {
  const toolSummary = toolCalls
    .map(
      (c) =>
        `### ${c.tool}\n${
          typeof c.result.data === "object"
            ? JSON.stringify(c.result.data, null, 2).substring(0, 800)
            : c.result.data
        }`
    )
    .join("\n");

  const prompt = `
You are composing the **FINAL ANSWER**.

User question: "${userMessage}"

Relevant data extracted from tools:
${toolSummary}

Chat history for tone reference:
${utils.formatChatHistory(chatHistory)}

Write a clear, helpful answer.
Use markdown; keep it concise but complete.
`;

  ctx.log(`🟦 [synthesizeFinalResponse] Prompt sent to LLM:\n${prompt}`);
  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
    }
  );
  ctx.log(`🟩 [synthesizeFinalResponse] LLM response:\n${response?.text}`);

  return {
    id: `step_${stepId}`,
    type: "synthesis",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Final synthesis of all gathered information",
  };
}
