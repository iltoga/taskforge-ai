import { SynthesisToolInputSchema } from "./synthesis-tool-definitions";
import { SynthesisTools } from "./synthesis-tools";
import { ToolRegistry } from "./tool-registry";

export function registerSynthesisTools(registry: ToolRegistry) {
  const TOOL_CATEGORY = "synthesis";
  registry.registerTool(
    {
      name: "synthesizeFinalAnswer",
      description:
        "Synthesizes a comprehensive, markdown-formatted answer for the user based on all tool results and orchestration steps.",
      parameters: SynthesisToolInputSchema,
      category: TOOL_CATEGORY,
    },
    async (parameters: Record<string, unknown>) => {
      // Cast parameters to the expected input type
      const result = await SynthesisTools.synthesizeFinalAnswer(
        parameters as import("./synthesis-tool-definitions").SynthesisToolInput
      );
      return {
        success: true,
        data: result,
      };
    }
  );

  registry.registerTool(
    {
      name: "synthesizeChat",
      description:
        "Summarizes the context of the chat up to this point, providing a concise overview.",
      parameters: SynthesisToolInputSchema,
      category: TOOL_CATEGORY,
    },
    async (parameters: Record<string, unknown>) => {
      const result = await SynthesisTools.synthesizeChat(
        parameters as import("./synthesis-tool-definitions").SynthesisToolInput
      );
      return {
        success: true,
        data: result,
      };
    }
  );
}
