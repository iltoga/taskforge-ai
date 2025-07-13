import { ModelType } from "@/appconfig/models";
import {
  createFileSignature,
  getFileSearchSignature,
} from "@/lib/file-search-session";
import { type AIProviderConfig } from "@/lib/openai";
import { ToolExecution, ToolRegistry } from "@/tools/tool-registry";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import * as steps from "./steps";
import { generatePlan } from "./steps";
import {
  OrchestrationResult,
  OrchestrationStep,
  OrchestratorConfig,
  OrchestratorContext,
  PlannedStep,
  ProgressCallback,
} from "./types";
import * as utils from "./utils";

/* ------------------------------------------------------------------ */
/* MAIN CLASS                                                         */
/* ------------------------------------------------------------------ */

export class ToolOrchestrator {
  private apiKey: string;
  private progressCallback?: ProgressCallback;
  private vectorStoreIds: string[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.loadVectorStoreConfig().catch((err) =>
      console.warn("Vector-store config load failed:", err)
    );
  }

  /* ----------------------- bootstrap helpers ----------------------- */

  /**
   * Loads the vector store configuration from `settings/vector-search.json`.
   * This file should contain an array of vector store IDs.
   * If the file does not exist or is invalid, it defaults to an empty array.
   *
   * This is used to determine which vector stores are available for vector search tools (custom knowledge tools).
   *
   * @returns {Promise<void>} Resolves when the configuration is loaded.
   * @throws {Error} If the file cannot be read or parsed.
   */
  private async loadVectorStoreConfig(): Promise<void> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const cfgPath = path.resolve(
        process.cwd(),
        "settings/vector-search.json"
      );
      const content = fs.readFileSync(cfgPath, "utf-8");
      const cfg = JSON.parse(content);
      this.vectorStoreIds = Array.isArray(cfg.vectorStoreIds)
        ? cfg.vectorStoreIds
        : [];
    } catch {
      this.vectorStoreIds = [];
    }
  }

  setProgressCallback(cb?: ProgressCallback): void {
    this.progressCallback = typeof cb === "function" ? cb : undefined;
  }

  private logProgress(msg: string): void {
    console.log(msg);
    this.progressCallback?.(msg);
  }

  /* ----------------------- provider resolver ----------------------- */

  private getAIConfig(model: ModelType): AIProviderConfig {
    if (model.includes("/") || model.includes(":")) {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("Missing OPENROUTER_API_KEY");
      return {
        provider: "openrouter",
        apiKey: key,
        baseURL: "https://openrouter.ai/api/v1",
      };
    }
    return {
      provider: "openai",
      apiKey: this.apiKey,
      baseURL: "https://api.openai.com/v1",
    };
  }

  /* ------------------------------------------------------------------ */
  /* PUBLIC API                                                         */
  /* ------------------------------------------------------------------ */

  async orchestrate(
    userMessage: string,
    chatHistory: ChatHistory,
    toolRegistry: ToolRegistry,
    model: ModelType = "gpt-4.1-mini",
    cfg: OrchestratorConfig = {},
    processedFiles: Array<ProcessedFile> = []
  ): Promise<OrchestrationResult> {
    const { maxSteps = 10, maxToolCalls = 5, developmentMode = false } = cfg;

    /* ---------- orchestrator context object ---------- */
    const ctx: OrchestratorContext = {
      apiKey: this.apiKey,
      vectorStoreIds: this.vectorStoreIds,
      log: (m) => this.logProgress(m),
      getAIConfig: (m) => this.getAIConfig(m),
    };

    /* ---------- orchestration state ---------- */
    const stepLog: OrchestrationStep[] = [];
    const toolLog: ToolExecution[] = [];
    const convo: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: userMessage },
    ];
    let stepId = 1;
    let toolCount = 0;
    let ctxString = userMessage;
    let needMore = true;

    try {
      this.logProgress("🚀 Orchestration started");

      // Auto-initialize file search if processedFiles are provided
      if (processedFiles.length > 0) {
        this.logProgress("📁 Initializing file search with uploaded files...");
        const hasFileSearchTools = toolRegistry
          .getAvailableTools()
          .some((t) => t.category === "file-search");
        if (hasFileSearchTools) {
          // check if fileSignature matches the current files
          const currentSignature = createFileSignature(processedFiles);
          const existingSignature = await getFileSearchSignature();
          if (currentSignature === existingSignature) {
            this.logProgress(
              "ℹ️ File search already initialized with these files. Skipping initialization."
            );
          } else {
            this.logProgress(
              "ℹ️ File search not initialized or files have changed. Initializing now..."
            );
          }
          try {
            const toolResult = await toolRegistry.executeTool(
              "initializeFileSearch",
              { files: processedFiles }
            );
            if (toolResult.success) {
              this.logProgress(
                `✅ File search initialized with ${processedFiles.length} files`
              );
            } else {
              this.logProgress(
                `⚠️ File search initialization failed: ${toolResult.error}`
              );
            }
          } catch (error) {
            console.error("💥 initializeFileSearch error:", error);
            this.logProgress(
              `⚠️ File search initialization error: ${
                error instanceof Error ? error.message : error
              }`
            );
          }
        } else {
          this.logProgress("⚠️ File search tools not available in registry");
        }
      }

      /* ----------- initial analysis ----------- */
      const analysis = await steps.performAnalysis(
        ctx,
        userMessage,
        chatHistory,
        toolRegistry,
        model,
        stepId++,
        processedFiles
      );
      stepLog.push(analysis);
      convo.push({
        role: "assistant",
        content: `Analysis: ${analysis.content}`,
      });

      /* ----------- create initial plan (Plan‑then‑Act) ----------- */
      const initialPlan: PlannedStep[] = await generatePlan(
        ctx,
        userMessage,
        toolRegistry,
        model,
        stepId,
        processedFiles,
        ctxString,
        toolLog
      );
      let plannedSteps: PlannedStep[] = [...initialPlan];

      /* ----------- main loop ----------- */
      while (
        needMore &&
        stepLog.length < maxSteps &&
        toolCount < maxToolCalls
      ) {
        /* planning – pop next step from current plan or re‑plan if empty */
        if (plannedSteps.length === 0) {
          this.logProgress("📜 Plan exhausted – generating new sub‑plan");
          plannedSteps = await generatePlan(
            ctx,
            userMessage,
            toolRegistry,
            model,
            stepId,
            processedFiles,
            ctxString,
            toolLog
          );
        }

        const nextPlan = plannedSteps.shift();
        if (!nextPlan) {
          throw new Error("Planner returned no tool actions");
        }

        let plannedCalls: {
          name: string;
          parameters: Record<string, unknown>;
        }[] = [{ name: nextPlan.tool, parameters: nextPlan.parameters }];

        /* auto-inject vectorStoreIds */
        plannedCalls = plannedCalls
          .map(
            (
              raw
            ): { name: string; parameters: Record<string, unknown> } | null => {
              let toolName = raw.name;

              // If returned like "PASSPORT.getPassports", strip prefix
              if (
                toolName &&
                !new Set(
                  toolRegistry.getAvailableTools().map((t) => t.name)
                ).has(toolName) &&
                toolName.includes(".")
              ) {
                toolName = toolName.split(".").pop() as string;
              }

              // --- alias common planner mistakes -----------------
              // The LLM sometimes returns "fileSearchTool" instead of the real
              // tool names.  Map those variants to the correct registry names.
              if (toolName === "fileSearchTool") {
                // If the planner asks to *start* file search we map to
                // initialise, otherwise default to search.
                toolName = "searchFiles";
              }

              // Remove vectorFileSearch option if no vector store configured
              const validToolNames = new Set(
                toolRegistry.getAvailableTools().map((t) => t.name)
              );
              if (ctx.vectorStoreIds.length === 0) {
                validToolNames.delete("vectorFileSearch");
              }

              // Remove synthesizeFinalAnswer - it should only be called as the final step
              // Other synthesis tools like synthesizeChat can be called during execution
              validToolNames.delete("synthesizeFinalAnswer");

              // If the planner produced an unknown tool, skip this planned call
              if (!toolName || !validToolNames.has(toolName)) {
                ctx.log(
                  `⚠️ Planner requested unknown tool "${toolName}". Skipping this step.`
                );
                return null;
              }

              return {
                name: toolName,
                parameters: raw.parameters ?? {},
              };
            }
          )
          .filter(
            (
              call
            ): call is { name: string; parameters: Record<string, unknown> } =>
              call !== null
          );

        /* execution */
        for (const call of plannedCalls) {
          if (toolCount >= maxToolCalls) break;

          // Extra safety: prevent synthesizeFinalAnswer from being called during main execution
          // Other synthesis tools like synthesizeChat are allowed
          if (call.name === "synthesizeFinalAnswer") {
            this.logProgress(
              `⚠️ Skipping ${call.name} - reserved for final step only`
            );
            continue;
          }

          /* auto-inject vectorStoreIds */
          if (
            call.name === "vectorFileSearch" &&
            !("vectorStoreIds" in call.parameters)
          ) {
            call.parameters.vectorStoreIds = this.vectorStoreIds;
          }

          // Log what is being passed to the tool
          this.logProgress(
            `🔧 Executing ${call.name} with parameters: ${JSON.stringify(
              call.parameters
            )}`
          );
          this.logProgress(
            `📋 Current context length: ${convo.length} messages`
          );

          const start = Date.now();
          const result = await toolRegistry.executeTool(
            call.name,
            call.parameters
          );
          const end = Date.now();

          const exec: ToolExecution = {
            tool: call.name,
            parameters: call.parameters,
            result,
            startTime: start,
            endTime: end,
            duration: end - start,
          };
          toolLog.push(exec);
          toolCount++;

          stepLog.push({
            id: `step_${stepId++}`,
            type: "tool_call",
            timestamp: Date.now(),
            content: `Executed ${call.name}`,
            toolExecution: exec,
          });

          // Inject actual tool output into conversation if it should be included
          if (utils.shouldInjectToolResult(call.name, result, convo)) {
            const toolOutput = utils.formatToolResultForChat(
              call.name,
              result,
              call.parameters
            );
            convo.push({
              role: "assistant",
              content: toolOutput,
            });
            this.logProgress(
              `📝 Injected tool output into conversation: ${utils.createToolExecutionSummary(
                exec
              )}`
            );
          } else {
            // Use simplified message if detailed output shouldn't be injected
            convo.push({
              role: "assistant",
              content: result.success
                ? `Tool ${call.name} succeeded`
                : `Tool ${call.name} failed`,
            });
            this.logProgress(
              `📝 Used simplified tool result message for ${call.name}`
            );
          }
        }

        /* evaluation */
        const evalStep = await steps.evaluateProgress(
          ctx,
          userMessage,
          ctxString,
          toolLog,
          stepLog,
          model,
          stepId++,
          convo
        );
        stepLog.push(evalStep);
        convo.push({
          role: "assistant",
          content: `Evaluation: ${evalStep.content}`,
        });

        needMore = utils.needsMoreInformation(evalStep.content);
        // Use enhanced context builder for better tool output formatting
        ctxString = utils.buildEnhancedContext(
          userMessage,
          toolLog,
          chatHistory
        );
        this.logProgress(
          `📊 Updated context with ${toolLog.length} tool executions`
        );
      }

      /* ----------- pre-synthesis validation (optional) ----------- */
      let validationFeedback = "";
      let needsRefinement = false;

      // Collect any validation concerns before final synthesis
      if (toolLog.length > 0) {
        const preValidate = await steps.validateResponseFormat(
          ctx,
          userMessage,
          utils.buildEnhancedContext(userMessage, toolLog, chatHistory), // Use enhanced context for validation
          model,
          stepId++
        );
        stepLog.push(preValidate);

        if (!this.isFormatAcceptable(preValidate.content)) {
          needsRefinement = true;
          validationFeedback = preValidate.content;
          this.logProgress(
            "📝 Pre-synthesis validation identified areas for improvement"
          );
        }
      }

      /* ----------- FINAL SYNTHESIS - ALWAYS USE synthesizeFinalAnswer TOOL ----------- */
      this.logProgress(
        "🎯 FINAL STEP: Performing synthesis using synthesizeFinalAnswer tool (this will be the only synthesis call)..."
      );

      // Prepare all context including any validation feedback
      const finalSynthesisInput = {
        userMessage,
        chatHistory,
        toolCalls: toolLog,
        previousSteps: stepLog,
        model,
        stepId: stepId++,
        aiConfig: this.getAIConfig(model),
        // Include enhanced context for better synthesis
        enhancedContext: utils.buildEnhancedContext(
          userMessage,
          toolLog,
          chatHistory
        ),
        conversationHistory: convo,
        // Include validation feedback if available
        ...(needsRefinement && { validationFeedback }),
      };

      this.logProgress(
        `📋 Final synthesis input includes ${toolLog.length} tool executions and ${convo.length} conversation messages`
      );

      // ALWAYS call synthesizeFinalAnswer - this is the final step
      const synthesisResult = await toolRegistry.executeTool(
        "synthesizeFinalAnswer",
        finalSynthesisInput
      );

      let synth: OrchestrationStep;
      if (synthesisResult.success && synthesisResult.data) {
        const synthesisData = synthesisResult.data as {
          content: string;
          reasoning: string;
        };
        synth = {
          id: `step_${stepId - 1}`,
          type: "synthesis",
          timestamp: Date.now(),
          content: synthesisData.content || "No response text available",
          reasoning:
            synthesisData.reasoning ||
            "Final synthesis using synthesizeFinalAnswer tool",
        };
        this.logProgress(
          "✅ Final synthesis completed successfully using synthesizeFinalAnswer tool"
        );
      } else {
        // If synthesis tool completely fails, create minimal fallback but log the issue
        this.logProgress(
          "❌ CRITICAL: synthesizeFinalAnswer tool failed - creating minimal fallback"
        );
        synth = {
          id: `step_${stepId - 1}`,
          type: "synthesis",
          timestamp: Date.now(),
          content:
            toolLog.length > 0
              ? `I was able to execute ${toolLog.length} tool(s) but encountered an error while formatting the final response. Please try your request again.`
              : "I encountered an error while processing your request. Please try again.",
          reasoning: "Emergency fallback due to synthesis tool failure",
        };
      }
      stepLog.push(synth);

      this.logProgress("✅ Orchestration finished");

      return {
        success: true,
        finalAnswer: synth.content,
        steps: developmentMode
          ? stepLog
          : stepLog.filter((s) => s.type === "synthesis"),
        toolCalls: toolLog,
      };
    } catch (err) {
      this.logProgress(
        `💥 Orchestration error: ${err instanceof Error ? err.message : err}`
      );
      return {
        success: false,
        finalAnswer:
          "I encountered an error while processing your request. Please try again.",
        steps: developmentMode ? stepLog : [],
        toolCalls: toolLog,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /* INTERNAL HELPERS                                                   */
  /* ------------------------------------------------------------------ */

  private isFormatAcceptable(validation: string): boolean {
    return /^FORMAT_ACCEPTABLE/i.test(validation.trim());
  }
}
