import { ToolExecution } from "@/tools/tool-registry";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import { ModelType } from "@/appconfig/models";
import { type AIProviderConfig } from "@/lib/openai";

/* ------------------------------------------------------------------ */
/* CORE STEP + RESULT SHAPES                                          */
/* ------------------------------------------------------------------ */

/** One atomic action the orchestrator performs. */
export interface OrchestrationStep {
  id: string;
  /** Where we are in the pipeline. */
  type: "analysis" | "tool_call" | "evaluation" | "synthesis";
  /** Unix-epoch milliseconds. */
  timestamp: number;
  /** Raw LLM or tool text produced at this step. */
  content: string;
  /** Populated only for type === "tool_call". */
  toolExecution?: ToolExecution;
  /** High-level explanation of *why* the step happened. */
  reasoning?: string;
}

/** Final envelope returned by `ToolOrchestrator.orchestrate()`. */
export interface OrchestrationResult {
  success: boolean;
  finalAnswer: string;
  steps: OrchestrationStep[];
  toolCalls: ToolExecution[];
  /** Present on hard-failures. */
  error?: string;
  /** Legacy flag kept for backwards compatibility. */
  fileProcessingUsed?: boolean;
}

/* ------------------------------------------------------------------ */
/* RUNTIME CONFIGURATION                                              */
/* ------------------------------------------------------------------ */

export interface OrchestratorConfig {
  /** Hard stop after this many pipeline steps (default 10). */
  maxSteps?: number;
  /** Hard stop after this many tool calls (default 5). */
  maxToolCalls?: number;
  /** When true, returns *all* steps; otherwise only synthesis. */
  developmentMode?: boolean;
}

/** Optional streaming hook used by the UI. */
export interface ProgressCallback {
  (message: string): void;
}

/* ------------------------------------------------------------------ */
/* INTERNAL CONTEXT PASSED TO HELPERS                                 */
/* ------------------------------------------------------------------ */

/**
 * Pure helper functions in `steps.ts` receive this object so they never
 * depend on `this` from the main class.  Only “read-only” services go
 * in here – no mutable orchestrator state.
 */
export type OrchestratorContext = {
  /** API key (OpenAI or OpenRouter) already resolved by the caller. */
  apiKey: string;
  /** Pre-loaded vector store IDs required by `vectorFileSearch`. */
  vectorStoreIds: string[];
  /** Thin wrapper around `ToolOrchestrator.logProgress`. */
  log(msg: string): void;
  /** Provider-specific configuration builder. */
  getAIConfig(model: ModelType): AIProviderConfig;
};

/* ------------------------------------------------------------------ */
/* BULK STRUCTS PASSED BETWEEN STEPS                                  */
/* ------------------------------------------------------------------ */

export type InternalConversation = Array<{
  role: "user" | "assistant";
  content: string;
}>;

export interface SynthesisToolParams {
  userMessage: string;
  chatHistory: ChatHistory;
  toolCalls: ToolExecution[];
  previousSteps: OrchestrationStep[];
  model: ModelType;
  stepId: number;
  processedFiles?: ProcessedFile[];
}
