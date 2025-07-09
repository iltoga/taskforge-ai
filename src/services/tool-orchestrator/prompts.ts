import { ToolRegistry } from "@/tools/tool-registry";
import * as utils from "@/services/tool-orchestrator/utils";

/* ------------------------------------------------------------------ */
/* INTERNAL HELPERS                                                   */
/* ------------------------------------------------------------------ */

/** Pretty print all tools grouped by category with parameter hints. */
function listToolsWithParams(
  registry: ToolRegistry,
  vectorStoreIds: string[]
): string {
  return registry
    .getAvailableCategories()
    .map((category) => {
      const items = registry
        .getToolsByCategory(category)
        .map(
          (t) =>
            `  • ${t.name}: ${
              t.description
            }\n    Parameters: ${utils.getToolParameterInfo(
              t.name,
              vectorStoreIds
            )}`
        )
        .join("\n");
      return `**${category.toUpperCase()}**\n${items}`;
    })
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/* PUBLIC API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Numbered rules that guide the LLM when it decides which tools to call.
 */
export function generateDecisionRules(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  let n = 1;
  const rules: string[] = [];

  if (cat.includes("calendar")) {
    rules.push(
      `${n++}. **Calendar queries** → ALWAYS use \`searchEvents\` or \`getEvents\` before answering.`,
      `${n++}. **Event creation / changes** → MUST call \`createEvent\`, \`updateEvent\` or \`deleteEvent\` accordingly.`
    );
  }

  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    rules.push(
      `${n++}. **Docs / visa / policy / general knowledge** → use \`vectorFileSearch\`. Include the \`vectorStoreIds\` array every time.`
    );
  }

  if (cat.includes("passport")) {
    rules.push(
      `${n++}. **Passport image / data operations** → use passport tools (\`createPassport\`, \`getPassports\`, etc.).`
    );
  }

  if (cat.includes("file")) {
    rules.push(
      `${n++}. **File-system operations** → use file tools (\`readFile\`, \`listFiles\`, …).`
    );
  }

  rules.push(
    `${n++}. If unsure which tool yields the required info, choose the **cheapest** query tool first.`,
    `${n++}. If no tool can help, reply with **SUFFICIENT_INFO** explaining why.`
  );

  return `**DECISION RULES**\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
}

/**
 * A one-shot ordered list telling the model which categories are more
 * important when several could apply.
 */
export function generatePriorityOrder(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const parts: string[] = ["**CATEGORY PRIORITY**"];

  if (cat.includes("calendar")) parts.push("1. Calendar tools");
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch"))
    parts.push(`${parts.length}. Knowledge (vectorFileSearch)`);
  if (cat.includes("passport")) parts.push(`${parts.length}. Passport`);
  if (cat.includes("file")) parts.push(`${parts.length}. File`);
  if (cat.includes("email")) parts.push(`${parts.length}. Email`);
  if (cat.includes("web")) parts.push(`${parts.length}. Web`);

  return parts.join("\n") + "\n";
}

/**
 * Global “always remember” bullets inserted in the analysis prompt.
 */
export function generateAnalysisInstructions(registry: ToolRegistry): string {
  const out: string[] = [
    "**ALWAYS REMEMBER**",
    "- Never guess; always prefer tool data.",
    "- Ask clarifying questions if user intent is vague.",
  ];

  if (registry.getAvailableCategories().includes("calendar")) {
    out.push(
      "- Use calendar tools for anything about meetings, schedules, projects, or dates."
    );
  }
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    out.push(
      "- For documentation / policy / visa questions, default to vectorFileSearch."
    );
  }
  if (registry.getAvailableCategories().includes("passport")) {
    out.push(
      "- When user uploads passport images or mentions passport fields, use passport tools to extract or manage data."
    );
  }

  return out.join("\n") + "\n";
}

/**
 * Bigger blocks that instruct the LLM how to interpret ambiguous queries.
 */
export function generateContextInstructions(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const blocks: string[] = [];

  if (cat.includes("calendar")) {
    blocks.push(
      "**CALENDAR CONTEXT**: Any mention of projects, meetings, schedules, status, timelines, or deadlines is a calendar query."
    );
  }
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    blocks.push(
      "**KNOWLEDGE CONTEXT**: Questions about policies, visas, procedures, or general info require vectorFileSearch."
    );
  }
  if (cat.includes("passport")) {
    blocks.push(
      "**PASSPORT CONTEXT**: When passport images or numbers are involved, use passport tools. Creating/Updating/Deleting requires database tools — extraction alone is not persistence."
    );
  }

  return blocks.join("\n") + "\n";
}

/**
 * Example analyses shown to the model so it can imitate the style.
 */
export function generateAnalysisExamples(registry: ToolRegistry): string {
  const ex: string[] = [];

  if (registry.getAvailableCategories().includes("calendar")) {
    ex.push(
      `**Example – Calendar search**
USER: "Show all Nespola meetings from March to June"
→ Decompose as: objective = list meetings; tool = searchEvents; params = {query:"nespola", timeRange:{start:"2025-03-01T00:00:00Z", end:"2025-06-30T23:59:59Z"}}.`
    );
  }

  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    ex.push(
      `**Example – Knowledge query**
USER: "What is the remote-work policy?"
→ Tool = vectorFileSearch; params = {query:"remote work policy", vectorStoreIds:[…]}.`
    );
  }

  return ex.join("\n\n") + "\n";
}

/**
 * Concrete CALL_TOOLS snippets the LLM can copy-paste.
 */
export function generateToolExamples(
  registry: ToolRegistry,
  vectorStoreIds: string[]
): string {
  const rows: string[] = [];

  /* Calendar */
  if (registry.getAvailableCategories().includes("calendar")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "searchEvents",\n    "parameters": {\n      "query": "project kickoff",\n      "timeRange": {"start": "2025-08-01T00:00:00Z", "end": "2025-08-31T23:59:59Z"}\n    },\n    "reasoning": "Need to list all kickoff meetings in August."\n  }\n]\n```'
    );
  }

  /* Vector search */
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "vectorFileSearch",\n    "parameters": {\n      "query": "visa requirements italy to indonesia",\n      "vectorStoreIds": ' +
        JSON.stringify(vectorStoreIds) +
        '\n    },\n    "reasoning": "Retrieve official visa requirement document." \n  }\n]\n```'
    );
  }

  /* Passport */
  if (registry.getAvailableCategories().includes("passport")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "createPassport",\n    "parameters": {\n      "passport_number": "YA1234567",\n      "surname": "DOE",\n      "given_names": "JOHN",\n      "nationality": "ITALIAN",\n      "date_of_birth": "1990-04-21",\n      "sex": "M",\n      "place_of_birth": "ROME",\n      "date_of_issue": "2020-05-01",\n      "date_of_expiry": "2030-04-30",\n      "issuing_authority": "ROME POLICE",\n      "holder_signature_present": true,\n      "type": "passport"\n    },\n    "reasoning": "Store extracted passport into DB."\n  }\n]\n```'
    );
  }

  return ["**EXAMPLE CALL_TOOLS BLOCKS**", ...rows].join("\n\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* UTILITY EXPORT: complete tool inventory text (optional helper)     */
/* ------------------------------------------------------------------ */

/** Convenience helper other files may use. */
export function fullToolInventory(
  registry: ToolRegistry,
  vectorStoreIds: string[]
): string {
  return listToolsWithParams(registry, vectorStoreIds);
}
