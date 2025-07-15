import {
  SynthesisToolInput,
  SynthesisToolOutput,
} from "@/tools/synthesis-tool-definitions";
import { generateTextWithProvider } from "../lib/openai";

export class SynthesisTools {
  static async synthesizeFinalAnswer(
    input: SynthesisToolInput
  ): Promise<SynthesisToolOutput> {
    const {
      userMessage,
      chatHistory,
      toolCalls,
      previousSteps,
      model,
      validationFeedback,
      enhancedContext,
      conversationHistory,
    } = input;

    // Types for toolCalls and previousSteps
    type ToolCall = {
      tool: string;
      parameters: Record<string, unknown>;
      result: {
        success: boolean;
        data?: unknown;
        error?: string;
        message?: string;
      };
      startTime: number;
      endTime: number;
      duration: number;
    };
    type Step = {
      id: string;
      type: string;
      content: string;
    };
    const toolCallsTyped = toolCalls as ToolCall[];
    const previousStepsTyped = previousSteps as Step[];

    const toolResults = toolCallsTyped
      .map((call) => {
        const summary = call.result.success
          ? `✅ **${call.tool}** completed successfully`
          : `❌ **${call.tool}** failed`;
        const timing = ` (${call.duration}ms)`;
        const data = call.result.data
          ? typeof call.result.data === "object"
            ? JSON.stringify(call.result.data, null, 2)
            : call.result.data
          : "No data returned";
        return `${summary}${timing}\n**Parameters:** ${JSON.stringify(
          call.parameters,
          null,
          2
        )}\n**Result:** ${data}\n**Message:** ${
          call.result.message || "N/A"
        }\n${call.result.error ? `**Error:** ${call.result.error}` : ""}`;
      })
      .join("\n\n---\n\n");

    const previousStepsContext =
      previousStepsTyped.length > 0
        ? `\n**Processing Steps Summary:**\n${previousStepsTyped
            .map((step) => {
              const content =
                step.content.length > 150
                  ? step.content.substring(0, 150) + "..."
                  : step.content;
              return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
            })
            .join("\n")}\n`
        : "";

    const prompt = `
  ## RESPONSE SYNTHESIS TASK

  ${
    enhancedContext
      ? `**ENHANCED CONTEXT (RECOMMENDED):**\n${enhancedContext}\n\n`
      : ""
  }

  ${chatHistory
    .map(
      (msg: { type: "user" | "assistant"; content: string }) =>
        `${msg.type === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n")}

  **User's Original Request:** "${userMessage}"
  ${previousStepsContext}
  ${
    validationFeedback
      ? `\n**VALIDATION FEEDBACK TO ADDRESS:**\n${validationFeedback}\n`
      : ""
  }

  ${
    conversationHistory && conversationHistory.length > 0
      ? `\n**INTERNAL CONVERSATION CONTEXT:**\n${conversationHistory
          .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join("\n")}\n`
      : ""
  }

  **Available Data from Tools:**
  ${
    enhancedContext
      ? "(See Enhanced Context above for detailed tool results)"
      : toolResults
  }

  ## SYNTHESIS REQUIREMENTS

  ### 1. COMPREHENSIVE RESPONSE
  Create a helpful, conversational response that:
  ${
    validationFeedback
      ? "- **ADDRESSES VALIDATION FEEDBACK**: Fix any formatting, tone, or content issues identified in the validation feedback above\n"
      : ""
  }
  - If, to answer the user's question, one or more tools' outputs must be shown to the user in the final answer, make sure to format that output properly as well (well-structured and user-friendly markdown).

  ### 2. MARKDOWN FORMATTING REQUIREMENTS

  **CRITICAL:**
  - **In CASE any tool output must be shown to the user to answer their question, you MUST reformat and summarize that output into well-structured, user-friendly markdown too, as part of your answer.**
  - **For any structured or extracted data (from any tool), always present it as a clear markdown table, list, or section.**
  - **If a tool returns a raw string, bullet list, or unformatted data, you MUST reformat it for clarity and readability.**
  - **ALL TABLES returnded by tools must be formatted as markdown tables.**

  **Example Structure:**
  ## [Summary Title]

  ### [Section Title]
  - Use bullet points, tables, or lists for structured data
  - Always use clear section headings

  ## Summary
  [Summarize the results and actions, based only on tool outputs]

  ## Important Note
  All information above comes from actual tool results. If no relevant data was found, clearly state this.

  ### 3. RESPONSE STRUCTURE

  ## QUALITY STANDARDS

  ## CRITICAL RULE
  **NEVER CLAIM ACTIONS WERE COMPLETED UNLESS TOOLS WERE ACTUALLY CALLED AND SUCCEEDED**

  If the user requested an action (create, update, delete) but no tools were called, or tools returned no relevant data, you MUST state that no information was found rather than generating any content. NEVER make up or fabricate information.

  Create your comprehensive, well-formatted markdown response below:
  `;

    // Defensive: Only pass a valid AIProviderConfig if present
    // Use type from openai.ts
    function isAIProviderConfig(
      obj: unknown
    ): obj is import("../lib/openai").AIProviderConfig {
      return (
        typeof obj === "object" &&
        obj !== null &&
        (obj as import("../lib/openai").AIProviderConfig).provider !==
          undefined &&
        (obj as import("../lib/openai").AIProviderConfig).apiKey !== undefined
      );
    }
    let config: import("../lib/openai").AIProviderConfig;
    if (isAIProviderConfig(input.aiConfig)) {
      // Normalize provider to ProviderType
      const provider =
        input.aiConfig.provider === "openai" ||
        input.aiConfig.provider === "openrouter"
          ? input.aiConfig.provider
          : "openai";
      config = {
        ...input.aiConfig,
        provider,
      } as import("../lib/openai").AIProviderConfig;
    } else {
      // fallback dummy config (should not be used in production)
      config = { provider: "openai", apiKey: "dummy" };
    }
    const supportsTemperature = ![
      "o4-mini",
      "o4-mini-high",
      "o3",
      "o3-mini",
    ].includes(model);

    const response = await generateTextWithProvider(prompt, config, {
      model,
      ...(supportsTemperature && { temperature: 0.3 }),
    });

    return {
      content: response?.text || "No response text available",
      reasoning:
        "Comprehensive synthesis of all gathered information into a user-friendly response",
    };
  }

  /**
   * synthesizeChat: Generates a conversational, markdown-formatted response for chat context.
   * @param input SynthesisToolInput
   * @returns SynthesisToolOutput
   */
  static async synthesizeChat(
    input: SynthesisToolInput
  ): Promise<SynthesisToolOutput> {
    const { userMessage, chatHistory, toolCalls, previousSteps, model } = input;

    type ToolCall = {
      tool: string;
      parameters: Record<string, unknown>;
      result: {
        success: boolean;
        data?: unknown;
        error?: string;
        message?: string;
      };
      startTime: number;
      endTime: number;
      duration: number;
    };
    type Step = {
      id: string;
      type: string;
      content: string;
    };
    const toolCallsTyped = toolCalls as ToolCall[];
    const previousStepsTyped = previousSteps as Step[];

    const toolResults = toolCallsTyped
      .map((call) => {
        const summary = call.result.success
          ? `✅ **${call.tool}** completed successfully`
          : `❌ **${call.tool}** failed`;
        const timing = ` (${call.duration}ms)`;
        const data = call.result.data
          ? typeof call.result.data === "object"
            ? JSON.stringify(call.result.data, null, 2)
            : call.result.data
          : "No data returned";
        return `${summary}${timing}\n**Parameters:** ${JSON.stringify(
          call.parameters,
          null,
          2
        )}\n**Result:** ${data}\n**Message:** ${
          call.result.message || "N/A"
        }\n${call.result.error ? `**Error:** ${call.result.error}` : ""}`;
      })
      .join("\n\n---\n\n");

    const previousStepsContext =
      previousStepsTyped.length > 0
        ? `\n**Processing Steps Summary:**\n${previousStepsTyped
            .map((step) => {
              const content =
                step.content.length > 150
                  ? step.content.substring(0, 150) + "..."
                  : step.content;
              return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
            })
            .join("\n")}\n`
        : "";

    const prompt = `
## CHAT RESPONSE SYNTHESIS

${chatHistory
  .map(
    (msg: { type: "user" | "assistant"; content: string }) =>
      `${msg.type === "user" ? "User" : "Assistant"}: ${msg.content}`
  )
  .join("\n")}

**User's Latest Message:** "${userMessage}"
${previousStepsContext}

**Tool Results:**
${toolResults}

---

You are an AI genius Assistant. Write a clear, conversational, markdown-formatted reply to the user, based strictly on the tool results and chat context above.

- If tool results are empty or no relevant data was found, politely state this.
- Do not fabricate or assume any information not present in the tool results.
- Use a friendly, concise tone suitable for chat.
- Use markdown for formatting, including lists, bold, tables and sections as appropriate.
- If the user requested an action but no tools were called, clearly state that no action was performed.
- Never provide translation services or make up calendar data.

Create your response below:
`;

    function isAIProviderConfig(
      obj: unknown
    ): obj is import("../lib/openai").AIProviderConfig {
      return (
        typeof obj === "object" &&
        obj !== null &&
        (obj as import("../lib/openai").AIProviderConfig).provider !==
          undefined &&
        (obj as import("../lib/openai").AIProviderConfig).apiKey !== undefined
      );
    }
    let config: import("../lib/openai").AIProviderConfig;
    if (isAIProviderConfig(input.aiConfig)) {
      const provider =
        input.aiConfig.provider === "openai" ||
        input.aiConfig.provider === "openrouter"
          ? input.aiConfig.provider
          : "openai";
      config = {
        ...input.aiConfig,
        provider,
      } as import("../lib/openai").AIProviderConfig;
    } else {
      config = { provider: "openai", apiKey: "dummy" };
    }
    const supportsTemperature = ![
      "o4-mini",
      "o4-mini-high",
      "o3",
      "o3-mini",
    ].includes(model);

    const response = await generateTextWithProvider(prompt, config, {
      model,
      ...(supportsTemperature && { temperature: 0.3 }),
    });

    return {
      content: response?.text || "No response text available",
      reasoning:
        "Conversational synthesis of tool results and chat context into a user-friendly markdown reply",
    };
  }
}
