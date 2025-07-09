import { z } from "zod";

export const SynthesisToolInputSchema = z.object({
  userMessage: z.string().describe("The original user request."),
  chatHistory: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.number(),
      })
    )
    .describe("The chat history up to this point."),
  toolCalls: z.array(z.unknown()).describe("Array of tool execution results."),
  previousSteps: z
    .array(z.unknown())
    .describe("Array of previous orchestration steps."),
  model: z.string().describe("The model name to use."),
  stepId: z.number().describe("The orchestration step id."),
  aiConfig: z
    .unknown()
    .optional()
    .describe("Optional AI config for the provider."),
});

export type SynthesisToolInput = z.infer<typeof SynthesisToolInputSchema>;

export const SynthesisToolOutputSchema = z.object({
  content: z.string().describe("The synthesized markdown response."),
  reasoning: z.string().describe("Reasoning for the synthesis."),
});

export type SynthesisToolOutput = z.infer<typeof SynthesisToolOutputSchema>;
