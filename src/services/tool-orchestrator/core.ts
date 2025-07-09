import { ModelType } from "@/appconfig/models";
import { type AIProviderConfig } from "@/lib/openai";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import {
  OrchestrationStep,
  OrchestrationResult,
  OrchestratorConfig,
  ProgressCallback,
  OrchestratorContext,
} from "./types";
import { ToolRegistry, ToolExecution } from "@/tools/tool-registry";
import * as utils from "./utils";
import * as steps from "./steps";

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
    return { provider: "openai", apiKey: this.apiKey, baseURL: undefined };
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

    // ...existing code...

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

      /* ----------- main loop ----------- */
      while (
        needMore &&
        stepLog.length < maxSteps &&
        toolCount < maxToolCalls
      ) {
        /* planning */
        const plan = await steps.decideToolUsage(
          ctx,
          ctxString,
          toolRegistry,
          toolLog,
          stepLog,
          model,
          stepId++,
          convo,
          processedFiles
        );
        stepLog.push(plan);
        convo.push({
          role: "assistant",
          content: `Tool planning: ${plan.content}`,
        });

        /* parse planned calls */
        let plannedCalls = utils.parseToolDecisions(plan.content);

        /* mandatory retry if no tools */
        if (plannedCalls.length === 0) {
          this.logProgress("🔁 No CALL_TOOLS – issuing forced retry");
          const retryPlan = await steps.decideToolUsage(
            ctx,
            ctxString + "\n\nSYSTEM_NOTE: A tool MUST be called.",
            toolRegistry,
            toolLog,
            stepLog,
            model,
            stepId++,
            convo,
            processedFiles
          );
          stepLog.push(retryPlan);
          convo.push({
            role: "assistant",
            content: `Tool planning (retry): ${retryPlan.content}`,
          });
          plannedCalls = utils.parseToolDecisions(retryPlan.content);
        }

        /* fallback if still empty */
        if (plannedCalls.length === 0) {
          plannedCalls = this.fallbackToolCalls(userMessage, toolRegistry);
          this.logProgress(
            `⚠️ Falling back to default tool(s): ${plannedCalls
              .map((t) => t.name)
              .join(", ")}`
          );
        }

        /* execution */
        for (const call of plannedCalls) {
          if (toolCount >= maxToolCalls) break;

          /* auto-inject vectorStoreIds */
          if (
            call.name === "vectorFileSearch" &&
            !("vectorStoreIds" in call.parameters)
          ) {
            call.parameters.vectorStoreIds = this.vectorStoreIds;
          }

          this.logProgress(`🔧 Executing ${call.name}`);
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

          convo.push({
            role: "assistant",
            content: result.success
              ? `Tool ${call.name} succeeded`
              : `Tool ${call.name} failed`,
          });
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
        ctxString = utils.buildUpdatedContext(userMessage, toolLog);
      }

      /* ----------- synthesis & validation loop ----------- */
      let synth = await steps.synthesizeFinalResponse(
        ctx,
        userMessage,
        chatHistory,
        toolLog,
        stepLog,
        model,
        stepId++
      );
      stepLog.push(synth);

      for (let i = 0; i < 3; i++) {
        const validate = await steps.validateResponseFormat(
          userMessage,
          synth.content,
          model,
          stepId++
        );
        stepLog.push(validate);
        if (this.isFormatAcceptable(validate.content)) break;

        synth = await steps.refineSynthesis(
          ctx,
          userMessage,
          chatHistory,
          ctxString,
          toolLog,
          stepLog,
          synth.content,
          validate.content,
          model,
          stepId++
        );
        stepLog.push(synth);
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

  private fallbackToolCalls(
    userMessage: string,
    registry: ToolRegistry
  ): Array<{ name: string; parameters: Record<string, unknown> }> {
    if (utils.isCalendarQuery(userMessage)) {
      return [{ name: "getEvents", parameters: {} }];
    }
    if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch"))
      return [
        {
          name: "vectorFileSearch",
          parameters: {
            query: userMessage,
            vectorStoreIds: this.vectorStoreIds,
          },
        },
      ];
    return [{ name: "getEvents", parameters: {} }];
  }

  private isFormatAcceptable(validation: string): boolean {
    return /^FORMAT_ACCEPTABLE/i.test(validation.trim());
  }
}
