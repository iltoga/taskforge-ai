import { SynthesisToolInputSchema } from "./synthesis-tool-definitions";
import { SynthesisTools } from "./synthesis-tools";
import { ToolRegistry } from "./tool-registry";

export function registerSynthesisTools(registry: ToolRegistry) {
  registry.registerTool(
    {
      name: "synthesizeFinalAnswer",
      description:
        "Synthesizes a comprehensive, markdown-formatted answer for the user based on all tool results and orchestration steps.",
      parameters: SynthesisToolInputSchema,
      category: "synthesis",
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
}
