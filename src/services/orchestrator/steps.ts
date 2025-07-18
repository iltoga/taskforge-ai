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

const TEMP_SENSITIVE_MODELS = new Set([
  "o4-mini",
  "o4-mini-high",
  "o3",
  "o3-mini",
]);

function supportsTemperature(model: ModelType): boolean {
  return !TEMP_SENSITIVE_MODELS.has(model as never);
}

// Shared utility to reduce duplication between performAnalysis and generatePlan
function createSharedPlanningContext(
  toolRegistry: ToolRegistry,
  vectorStoreIds: string[],
  processedFiles: ProcessedFile[] = [],
  toolExecutions?: ToolExecution[],
  currentContext?: string
) {
  const categorizedTools = toolListWithParams(toolRegistry, vectorStoreIds);

  // Create valid tool names set
  const validToolNames = new Set(
    toolRegistry.getAvailableTools().map((t) => t.name)
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

  return {
    categorizedTools,
    validToolNames,
    fileInfoForAnalysis,
    fileInfoForPlanning,
    previousToolContext,
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

function toolListWithParams(reg: ToolRegistry, vectorIds: string[]) {
  return reg
    .getAvailableCategories()
    .map((cat) => {
      const items = reg
        .getToolsByCategory(cat)
        .filter((t) => t.name !== "synthesizeFinalAnswer") // Exclude only synthesizeFinalAnswer from planning
        .map(
          (t) =>
            `  - ${t.name}: ${
              t.description
            }\n    Parameters: ${utils.getToolParameterInfo(t.name, vectorIds)}`
        )
        .join("\n");
      return items ? `**${cat.toUpperCase()}**:\n${items}` : null;
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
  } = createSharedPlanningContext(
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

Create the most efficient, shortest path plan to fulfil the goal.

IMPORTANT: For file search operations:
- Use "searchFiles" with a "query" parameter (natural language query)
- Never use "files" parameter
- Example: {"tool": "searchFiles", "parameters": {"query": "extract passport details"}}

IMPORTANT: For calendar operations:
- When user says "today", use the current date: ${currentDate}
- When user says "tomorrow", use the next day after current date
- Always include proper time zones (e.g., "+02:00" or "UTC") in dateTime fields
- Example: {"tool": "createEvent", "parameters": {"eventData": {"summary": "Meeting", "start": {"dateTime": "2025-07-17T14:00:00+02:00"}, "end": {"dateTime": "2025-07-17T15:00:00+02:00"}}}}

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
    max_tokens: 512,
    temperature: 0,
  });
  ctx.log(`� [generatePlan] LLM response:\n${llm?.text}`);

  let plannedCalls: RawPlanCall[] =
    utils.parseToolDecisions(llm?.text ?? "") || [];

  // If the LLM returned raw JSON (no CALL_TOOLS wrapper) parse it.
  if (plannedCalls.length === 0) {
    try {
      plannedCalls = JSON.parse(llm?.text ?? "[]");
    } catch {
      plannedCalls = [];
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
  return res;
}

/* === ANALYSIS ========================================================= */
export async function performAnalysis(
  ctx: OrchestratorContext,
  userMessage: string,
  chatHistory: ChatHistory,
  toolRegistry: ToolRegistry,
  model: ModelType,
  stepId: number,
  processedFiles: ProcessedFile[] = []
): Promise<OrchestrationStep> {
  const { fileInfoForAnalysis } = createSharedPlanningContext(
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
      ...(supportsTemperature(model) && { temperature: 0.1 }),
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
  const categorizedTools = toolListWithParams(toolRegistry, ctx.vectorStoreIds);

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
      ...(supportsTemperature(model) && { temperature: 0.1 }),
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
      ...(supportsTemperature(model) && { temperature: 0.1 }),
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
      ...(supportsTemperature(model) && { temperature: 0.1 }),
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
      ...(supportsTemperature(model) && { temperature: 0.3 }),
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
      ...(supportsTemperature(model) && { temperature: 0.3 }),
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
