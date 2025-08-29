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
import { analyzeAndPlan, generatePlan } from "./steps";
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

  /**
   * Test helper: delegate to utils.parseToolDecisions
   */

  public parseToolDecisions(
    content: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Array<{ name: string; parameters: Record<string, any> }> {
    return utils.parseToolDecisions(content) as Array<{
      name: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parameters: Record<string, any>;
    }>;
  }

  /**
   * Test helper: delegate to utils.needsMoreInformation
   */
  public needsMoreInformation(content: string): boolean {
    return utils.needsMoreInformation(content);
  }

  async orchestrate(
    userMessage: string,
    chatHistory: ChatHistory,
    toolRegistry: ToolRegistry,
    model: ModelType = (process.env.OPENAI_DEFAULT_MODEL as ModelType) ||
      "gpt-5-mini",
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
          .some((t: { category: string }) => t.category === "file-search");
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
                `❌ File search initialization failed: ${toolResult.error}`
              );
              console.error(
                "File search initialization failed:",
                toolResult.error
              );
              // Don't terminate here - continue with orchestration,
              // but file search tools will properly handle the not-initialized state
            }
          } catch (error) {
            console.error("💥 initializeFileSearch error:", error);
            this.logProgress(
              `❌ File search initialization error: ${
                error instanceof Error ? error.message : error
              }`
            );
            // Don't terminate here - continue with orchestration
          }
        } else {
          this.logProgress("⚠️ File search tools not available in registry");
        }
      }

      /* ----------- combined analyze + plan (Phase 1 optimization) ----------- */
      const combo = await analyzeAndPlan(
        ctx,
        userMessage,
        toolRegistry,
        model,
        stepId++,
        processedFiles,
        ctxString,
        toolLog
      );
      stepLog.push({
        id: `step_${stepId - 1}`,
        type: "analysis",
        timestamp: Date.now(),
        content: combo.analysisContent,
        reasoning: "Combined analysis + initial planning",
      });
      const analysisPreviewLength =
        Number(process.env.ANALYSIS_PREVIEW_LENGTH) || 400;
      convo.push({
        role: "assistant",
        content: `Analysis+Plan: ${combo.analysisContent.substring(
          0,
          analysisPreviewLength
        )}...`,
      });

      let initialPlan: PlannedStep[] = combo.planned;
      if (initialPlan.length === 0) {
        this.logProgress(
          "⚠️ Combined planner produced no steps; attempting legacy generatePlan fallback"
        );
        initialPlan = await generatePlan(
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

        const first = plannedSteps.shift();
        if (!first) {
          // Replan once if nothing
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
          if (plannedSteps.length === 0) {
            this.logProgress(
              "🛑 Planner returned no tool actions after retry. Ending orchestration gracefully."
            );
            break;
          }
        }

        // Collect batch: start with first (if any) then greedily pull consecutive read‑only steps
        const batch: Array<{
          name: string;
          parameters: Record<string, unknown>;
        }> = [];
        const pushPlanned = (p: PlannedStep | undefined) => {
          if (!p) return;
          batch.push({ name: p.tool, parameters: p.parameters });
        };
        pushPlanned(first);

        const batchLimit = Number(process.env.READ_ONLY_BATCH_LIMIT) || 4;
        while (
          batch.length < batchLimit &&
          plannedSteps.length > 0 &&
          toolCount + batch.length < maxToolCalls &&
          utils.isReadOnlyTool(plannedSteps[0].tool) &&
          utils.isReadOnlyTool(batch[0].name) // ensure first is read‑only too
        ) {
          pushPlanned(plannedSteps.shift());
        }

        // Normalise + alias / validate each call; drop invalid
        // Use async method to get all tools including MCP
        // Retrieve all available tools (prefer async method when supported to include MCP)
        let availableTools = toolRegistry.getAvailableTools();
        const maybeAsyncTools = toolRegistry as unknown as {
          getAllAvailableTools?: () => Promise<typeof availableTools>;
        };
        if (typeof maybeAsyncTools.getAllAvailableTools === "function") {
          availableTools = await maybeAsyncTools.getAllAvailableTools();
        }
        const validToolNames = new Set(availableTools.map((t) => t.name));
        if (ctx.vectorStoreIds.length === 0)
          validToolNames.delete("vectorFileSearch");
        validToolNames.delete("synthesizeFinalAnswer");

        const normalised = batch
          .map((raw) => {
            let toolName = raw.name;
            if (
              toolName &&
              !validToolNames.has(toolName) &&
              toolName.includes(".")
            ) {
              toolName = toolName.split(".").pop() as string;
            }
            if (toolName === "fileSearchTool") toolName = "searchFiles";
            if (!toolName || !validToolNames.has(toolName)) {
              ctx.log(
                `⚠️ Planner requested unknown tool "${toolName}". Skipping.`
              );
              return null;
            }
            return { name: toolName, parameters: raw.parameters ?? {} };
          })
          .filter(
            (c): c is { name: string; parameters: Record<string, unknown> } =>
              c !== null
          );

        // If we have more than one and not all are read‑only, collapse to first only
        const allReadOnly = normalised.every((c) =>
          utils.isReadOnlyTool(c.name)
        );
        const executeCalls =
          normalised.length > 1 && allReadOnly
            ? normalised
            : normalised.slice(0, 1);

        const isBatch = executeCalls.length > 1;
        if (isBatch) {
          this.logProgress(
            `⚡ Executing read‑only batch of ${
              executeCalls.length
            } tools: ${executeCalls.map((c) => c.name).join(", ")}`
          );
        }

        const batchResults: ToolExecution[] = [];

        // Execute (batch or single) possibly in parallel
        const executions = await Promise.all(
          executeCalls.map(async (call) => {
            if (toolCount >= maxToolCalls) return null;

            if (call.name === "synthesizeFinalAnswer") {
              this.logProgress(
                `⚠️ Skipping ${call.name} - reserved for final step only`
              );
              return null;
            }

            // vector store ids
            if (
              call.name === "vectorFileSearch" &&
              !("vectorStoreIds" in call.parameters)
            ) {
              call.parameters.vectorStoreIds = this.vectorStoreIds;
            }

            // Pre-execution sanitization for calendar events
            if (
              (call.name === "createEvent" || call.name === "updateEvent") &&
              call.parameters &&
              typeof call.parameters === "object"
            ) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p: any = call.parameters;
                if (call.name === "createEvent" && p.eventData) {
                  // Auto-fill summary if empty using simple heuristic from user message
                  if (
                    !p.eventData.summary ||
                    p.eventData.summary.trim() === ""
                  ) {
                    const nameMatch = userMessage.match(
                      /for\s+([A-Z]?[a-z]+)\s+([A-Z]?[a-z]+)/i
                    );
                    let guessed = "Event";
                    if (nameMatch) {
                      const nm = `${nameMatch[1]} ${nameMatch[2]}`.replace(
                        /\b(\w)/g,
                        (c) => c.toUpperCase()
                      );
                      // Generic action extraction (keep in sync with steps.ts heuristic)
                      const actionMatch = userMessage.match(
                        /(start|begin|kickoff|submit|review|plan|create|schedule)\s+([^\.]{0,60})/i
                      );
                      if (actionMatch) {
                        const rawTail = actionMatch[2]
                          .replace(/\s+/g, " ")
                          .trim()
                          .replace(/[.,;:!?].*$/, "");
                        const words = rawTail
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 3);
                        const base = [actionMatch[1], ...words]
                          .join(" ")
                          .replace(/\b(\w)/g, (c) => c.toUpperCase());
                        guessed = `${base} — ${nm}`;
                      } else {
                        guessed = `Event — ${nm}`;
                      }
                    }
                    p.eventData.summary = guessed;
                  }

                  // If description missing & passport data present in prior tool calls, embed it (PII awareness left to higher-level consent checks)
                  if (!p.eventData.description) {
                    const passportExec = [...toolLog]
                      .reverse()
                      .find(
                        (e) =>
                          e.tool === "getPassports" &&
                          e.result.success &&
                          e.result.data
                      );
                    if (
                      passportExec &&
                      Array.isArray(passportExec.result.data) &&
                      passportExec.result.data.length
                    ) {
                      const first = passportExec.result.data[0] as Record<
                        string,
                        unknown
                      >;
                      const lines = Object.entries(first)
                        .filter(
                          ([k]) =>
                            ![
                              "id",
                              "documentId",
                              "createdAt",
                              "updatedAt",
                            ].includes(k)
                        )
                        .map(([k, v]) => `${k}: ${v}`);
                      p.eventData.description = `Passport data (sensitive):\n${lines.join(
                        "\n"
                      )}`;
                    }
                  }
                  p.eventData = this.sanitizeCalendarEventData(
                    userMessage,
                    p.eventData
                  );
                } else if (call.name === "updateEvent" && p.changes) {
                  p.changes = this.sanitizeCalendarEventData(
                    userMessage,
                    p.changes
                  );
                }
              } catch (e) {
                console.warn("Calendar payload sanitize failed:", e);
              }
            }

            this.logProgress(
              `🔧 Executing ${call.name} with parameters: ${JSON.stringify(
                call.parameters
              )}`
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
            batchResults.push(exec);
            toolLog.push(exec);
            toolCount++;

            stepLog.push({
              id: `step_${stepId++}`,
              type: "tool_call",
              timestamp: Date.now(),
              content: `Executed ${call.name}`,
              toolExecution: exec,
            });

            if (!result.success) {
              console.error(
                `❌ Tool ${call.name} failed:`,
                result.error,
                "Parameters:",
                call.parameters
              );
              this.logProgress(`❌ Tool ${call.name} failed: ${result.error}`);
            }
            return exec;
          })
        );

        // Conversation injection (compact if batch)
        if (isBatch) {
          const summary = batchResults
            .map((r) => `${r.tool}:${r.result.success ? "OK" : "FAIL"}`)
            .join(" | ");
          convo.push({
            role: "assistant",
            content: `Batch results: ${summary}`,
          });
          this.logProgress(`📝 Injected batch summary: ${summary}`);
        } else {
          const single = executions.find((e) => e !== null);
          if (single) {
            const { tool, result, parameters } = single;
            if (utils.shouldInjectToolResult(tool, result, convo)) {
              convo.push({
                role: "assistant",
                content: utils.formatToolResultForChat(
                  tool,
                  result,
                  parameters
                ),
              });
              this.logProgress(
                `📝 Injected tool output into conversation: ${utils.createToolExecutionSummary(
                  single
                )}`
              );
            } else {
              convo.push({
                role: "assistant",
                content: result.success
                  ? `Tool ${tool} succeeded`
                  : `Tool ${tool} failed`,
              });
              this.logProgress(
                `📝 Used simplified tool result message for ${tool}`
              );
            }
          }
        }

        /* evaluation: always run to let the LLM decide whether to continue */
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
        this.logProgress(`ℹ️ Current context length: ${ctxString.length}`);
      }

      /* Ensure context is available and log its length even if no loop iterations occurred */
      if (!ctxString || ctxString === userMessage) {
        ctxString = utils.buildEnhancedContext(
          userMessage,
          toolLog,
          chatHistory
        );
        // Mirror loop logging semantics even if no tools ran
        this.logProgress(
          `📊 Updated context with ${toolLog.length} tool executions`
        );
        this.logProgress(`ℹ️ Current context length: ${ctxString.length}`);
      }
      if (toolLog.length === 0) {
        this.logProgress("📝 Used simplified tool result (no tool executions)");
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
        // No pre-synthesis validation; will validate after synthesis if desired
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

      /* ----------- POST-SYNTHESIS VALIDATION (optional, non-blocking) ----------- */
      if (toolLog.length > 0 && toolLog[toolLog.length - 1]?.result.success) {
        const postValidate = await steps.validateResponseFormat(
          ctx,
          userMessage,
          synth.content,
          model,
          stepId++
        );
        stepLog.push(postValidate);
        if (!this.isFormatAcceptable(postValidate.content)) {
          this.logProgress(
            "📝 Post-synthesis validation suggests improvements (non-blocking)"
          );
        }
      }

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

  /**
   * Ensure calendar event payloads are consistent and robust:
   * - If only start.date is provided, auto-set end.date = start + 1 day (all-day event)
   * - If only start.dateTime is provided, auto-set end.dateTime = start + 1 hour (UTC preserved if provided)
   * - If start/end mix date and dateTime, prefer all-day when the user did not specify a time; otherwise coerce to dateTime pair
   * - If only end is provided, infer start accordingly
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitizeCalendarEventData(userMessage: string, data: any): any {
    if (!data || typeof data !== "object") return data;

    const clone = { ...data };
    clone.start = clone.start || {};
    clone.end = clone.end || {};

    const hasStartDate = typeof clone.start.date === "string";
    const hasStartDT = typeof clone.start.dateTime === "string";
    const hasEndDate = typeof clone.end.date === "string";
    const hasEndDT = typeof clone.end.dateTime === "string";

    const userMentionsTime =
      /(\d{1,2}:\d{2})|noon|morning|afternoon|evening|am|pm/i.test(userMessage);

    const prefersAllDay = !userMentionsTime || hasStartDate || hasEndDate;

    // Helper to add days to YYYY-MM-DD
    const addDays = (isoDate: string, days: number) => {
      const d = new Date(isoDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };

    // If only end is provided, infer start
    if (!hasStartDate && !hasStartDT && (hasEndDate || hasEndDT)) {
      if (hasEndDate) {
        // Make a 1-day all-day ending at end.date => start = end - 1 day
        clone.start.date = addDays(clone.end.date, -1);
      } else if (hasEndDT) {
        const end = new Date(clone.end.dateTime);
        const start = new Date(end.getTime() - 60 * 60 * 1000);
        clone.start.dateTime = start.toISOString();
      }
    }

    // Recompute flags
    const _hasStartDate = typeof clone.start.date === "string";
    const _hasStartDT = typeof clone.start.dateTime === "string";
    const _hasEndDate = typeof clone.end.date === "string";
    const _hasEndDT = typeof clone.end.dateTime === "string";

    // If both are missing, leave to upstream validation
    if (!_hasStartDate && !_hasStartDT && !_hasEndDate && !_hasEndDT) {
      return clone;
    }

    // If start provided, ensure end exists and types match
    if (_hasStartDate || _hasEndDate || prefersAllDay) {
      // Prefer all-day
      const startDate = _hasStartDate
        ? clone.start.date
        : _hasStartDT
        ? clone.start.dateTime.slice(0, 10)
        : undefined;
      if (startDate) {
        clone.start = { date: startDate, timeZone: clone.start.timeZone };
        clone.end = {
          date: addDays(startDate, 1),
          timeZone: clone.end.timeZone || clone.start.timeZone,
        };
        return clone;
      }
    }

    // Otherwise ensure dateTime pair
    if (_hasStartDT || _hasEndDT) {
      const startDT = _hasStartDT
        ? new Date(clone.start.dateTime)
        : _hasStartDate
        ? new Date(clone.start.date + "T09:00:00Z")
        : new Date();
      const endDT = _hasEndDT
        ? new Date(clone.end.dateTime)
        : new Date(startDT.getTime() + 60 * 60 * 1000);
      clone.start = {
        dateTime: startDT.toISOString(),
        timeZone: clone.start.timeZone,
      };
      clone.end = {
        dateTime: endDT.toISOString(),
        timeZone: clone.end.timeZone || clone.start.timeZone,
      };
      return clone;
    }

    return clone;
  }
}
