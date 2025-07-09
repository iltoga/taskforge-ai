import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import { ModelType } from "@/appconfig/models";
import { ToolRegistry, ToolExecution } from "@/tools/tool-registry";
import {
  OrchestrationStep,
  OrchestratorContext,
} from "@/services/tool-orchestrator/types";
import * as prompts from "@/services/tool-orchestrator/prompts";
import * as utils from "@/services/tool-orchestrator/utils";
import { uploadedFileToImageDataUrl } from "@/lib/image-helpers";
import { generateTextWithProvider } from "@/lib/openai";

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

async function imagesFromFiles(files: ProcessedFile[]) {
  return Promise.all(
    files
      .filter((f) => f.isImage)
      .map(async (f) => ({
        imageData: await uploadedFileToImageDataUrl(f.fileName, f.fileType),
        mimeType: f.fileType || "image/png",
      }))
  );
}

function toolListWithParams(reg: ToolRegistry, vectorIds: string[]) {
  return reg
    .getAvailableCategories()
    .map((cat) => {
      const items = reg
        .getToolsByCategory(cat)
        .map(
          (t) =>
            `  - ${t.name}: ${
              t.description
            }\n    Parameters: ${utils.getToolParameterInfo(t.name, vectorIds)}`
        )
        .join("\n");
      return `**${cat.toUpperCase()}**:\n${items}`;
    })
    .join("\n\n");
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
  const categorizedTools = toolListWithParams(toolRegistry, ctx.vectorStoreIds);
  const fileInfo =
    processedFiles.length > 0
      ? `\n\n**FILE CONTEXT INFORMATION**:\n${processedFiles
          .map(
            (f) =>
              `- ${f.fileName} (${f.fileSize} bytes, ${
                f.isImage ? "image" : "file"
              })`
          )
          .join("\n")}`
      : "";

  const prompt = `
Today is ${new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.

You are an **AI ASSISTANT** with tool-orchestration powers.
Analyze the user's request and lay out a strategy.

---START CONTEXT---
${utils.formatChatHistory(chatHistory)}
---END CONTEXT---

**USER REQUEST**: "${userMessage}"${fileInfo}

**TOOLS**
${categorizedTools}

${prompts.generateAnalysisInstructions(toolRegistry)}
${prompts.generateContextInstructions(toolRegistry)}
${prompts.generateAnalysisExamples(toolRegistry)}

Provide sections:
1. REQUEST DECOMPOSITION
2. TOOL STRATEGY
3. INFORMATION REQUIREMENTS
4. APPROACH PLAN
5. COMPLEXITY ASSESSMENT
`;

  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      images: processedFiles.length
        ? await imagesFromFiles(processedFiles)
        : undefined,
      ...(supportsTemperature(model) && { temperature: 0.1 }),
    }
  );

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
    ? processedFiles.map((f) => `- ${f.fileName}`).join("\n")
    : "None"
}

## TOOLS
${categorizedTools}

${prompts.generateDecisionRules(toolRegistry)}
${prompts.generatePriorityOrder(toolRegistry)}
${prompts.generateToolExamples(toolRegistry, ctx.vectorStoreIds)}

Respond with either CALL_TOOLS json array or SUFFICIENT_INFO message exactly as specified.
`;

  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      images: processedFiles.length
        ? await imagesFromFiles(processedFiles)
        : undefined,
      ...(supportsTemperature(model) && { temperature: 0.1 }),
    }
  );

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
  const toolResults = toolCalls
    .map(
      (c) =>
        `## ${c.tool} ${c.result.success ? "✅" : "❌"}\nResult: ${
          typeof c.result.data === "object"
            ? JSON.stringify(c.result.data, null, 2).substring(0, 400)
            : c.result.data
        }`
    )
    .join("\n\n");

  const prompt = `
## PROGRESS CHECK

User asked: "${originalMsg}"
Current context: "${currentContext}"

Tool outcomes:
${toolResults}

Steps so far: ${prevSteps.length}
${internalConv.length ? utils.formatInternalConversation(internalConv) : ""}

Should we CONTINUE to gather info or is it COMPLETE?
Respond with \`CONTINUE:\` or \`COMPLETE:\` and your reasoning.
`;

  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      ...(supportsTemperature(model) && { temperature: 0.1 }),
    }
  );

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

  const response = await generateTextWithProvider(
    prompt,
    { provider: "openai", apiKey: "", baseURL: undefined }, // doesn't use key
    { model: "gpt-3.5-turbo" }
  );

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

  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      ...(supportsTemperature(model) && { temperature: 0.3 }),
    }
  );

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

  const response = await generateTextWithProvider(
    prompt,
    ctx.getAIConfig(model),
    {
      model,
      ...(supportsTemperature(model) && { temperature: 0.3 }),
    }
  );

  return {
    id: `step_${stepId}`,
    type: "synthesis",
    timestamp: Date.now(),
    content: response?.text || "No response",
    reasoning: "Final synthesis of all gathered information",
  };
}
