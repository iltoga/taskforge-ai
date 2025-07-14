import { ToolRegistry } from "@/tools/tool-registry";
import * as utils from "./utils";

/* ------------------------------------------------------------------ */
/* PUBLIC API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Global “always remember” bullets inserted in the analysis prompt.
 * @deprecated
 */
export function generateAnalysisInstructions(registry: ToolRegistry): string {
  const out: string[] = [
    "**ALWAYS REMEMBER**",
    "- Never guess; always prefer tool data.",
    "- Ask clarifying questions if user intent is vague.",
  ];

  if (registry.getAvailableCategories().includes("file-search")) {
    out.push(
      "- Use searchFiles tools to search the content of uploaded files using natural language queries with a 'query' parameter (a descriptive string like 'passport details' or 'extract document information' or whatever is the users's intent with the files).",
      "- Use searchFiles tool with a descriptive query string like 'passport details' or 'extract document information'.",
      "- Use getDocumentByName tool to retrieve a specific document from db by its exact filename."
    );
  }

  if (registry.getAvailableCategories().includes("calendar")) {
    out.push(
      "- Use calendar tools to search, list, or filter events by date, time, or keywords.",
      "- Use calendar tools to create new events with details such as title, time, location, and attendees.",
      "- Use calendar tools to update or modify existing events when changes are needed.",
      "- Use calendar tools to delete events when removal is requested."
    );
  }

  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    out.push(
      "- For general knowledge / documentation / policy / visa questions, default to vectorFileSearch."
    );
  }
  if (registry.getAvailableCategories().includes("passport")) {
    out.push(
      "- Use passport tools to create new passport records with required fields (name, number, dates, nationality).",
      "- Use passport tools to search and retrieve existing passport records using flexible filters (surname, given names, passport number, nationality, dates).",
      "- Ensure data is translated or normalized where required before storage."
    );
  }
  if (registry.getAvailableCategories().includes("email")) {
    out.push(
      "- Use email tools to send messages with recipients, subject, body, and attachments.",
      "- Use email tools to search or list emails using filters (from, to, subject, dateRange, isRead).",
      "- Use email tools to retrieve full email details by ID.",
      "- Use email tools to reply to emails or mark them as read/unread."
    );
  }
  if (registry.getAvailableCategories().includes("web")) {
    out.push(
      "- Use web tools to search the web for information using searchWeb with optional filters.",
      "- Use web tools to fetch and inspect a page using getWebPageContent.",
      "- Use web tools to summarize long pages with summarizeWebPage.",
      "- Use web tools to check site availability with checkWebsite.",
      "- Use web tools to extract hyperlinks with extractLinks and monitorWebsite for changes."
    );
  }
  if (registry.getAvailableCategories().includes("synthesis")) {
    out.push(
      "- Use synthesizeChat to summarize the chat history or tool outputs mid-orchestration.",
      // "- Use synthesizeFinalAnswer to compose the final markdown-formatted response for the user.", // note: this one is used automatically by the orchestrator as final step
      "- Use validation and refinement tools to ensure output meets required format and feedback."
    );
  }

  return out.join("\n") + "\n";
}

/**
 * Bigger blocks that instruct the LLM how to interpret ambiguous queries.
 * @deprecated
 */
export function generateContextInstructions(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const blocks: string[] = [];

  // File-search context for uploaded documents
  if (cat.includes("searchFiles")) {
    blocks.push(
      "**FILE SEARCH CONTEXT**: Use searchFiles tools to search the content of uploaded files with descriptive natural language queries. Always use the 'query' parameter with searchFiles, never 'files' parameter."
    );
  }
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    blocks.push(
      "**KNOWLEDGE CONTEXT**: Questions about policies, visas, procedures, or general info require vectorFileSearch."
    );
  }
  if (cat.includes("calendar")) {
    blocks.push(
      "**CALENDAR CONTEXT**: Any mention of projects, meetings, schedules, status, timelines, or deadlines is a calendar query."
    );
  }
  if (cat.includes("synthesis")) {
    blocks.push(
      "**SYNTHESIS CONTEXT**: Use synthesis tools to summarize or finalize responses, ensuring clarity and markdown formatting."
    );
  }
  if (cat.includes("passport")) {
    blocks.push(
      "**PASSPORT CONTEXT**: Use passport tools for creating, searching, retrieving, or managing passport records. Fields may require translation or normalization before storage. do not try to guess the passport data, always use the passport tools to extract it from the uploaded document or provided by the user."
    );
  }
  if (cat.includes("email")) {
    blocks.push(
      "**EMAIL CONTEXT**: Use email tools for composing, sending, searching, retrieving, replying, or marking emails as read/unread."
    );
  }
  if (cat.includes("web")) {
    blocks.push(
      "**WEB CONTEXT**: Use web tools to gather information from the internet, fetch page content, summarize, check availability, extract links, or monitor changes."
    );
  }

  return blocks.join("\n") + "\n";
}

/**
 * Example analyses shown to the model so it can imitate the style.
 *
 * @deprecated
 */
export function generateAnalysisExamples(registry: ToolRegistry): string {
  const ex: string[] = [];

  if (registry.getAvailableCategories().includes("file-search")) {
    ex.push(
      `**Example – File search**
USER: "Extract data from uploaded files and summarize."
→ Tool = searchFiles; params = {query:"extract all data and summarize uploaded documents"}.`,
      `**Example – Search uploaded files**
USER: "Search uploaded files for project guidelines."
→ Tool = searchFiles; params = {query:"project guidelines"}.`,
      `**Example – Get document by name**
USER: "Retrieve the document named 'design.docx' from db."
→ Tool = getDocumentByName; params = {name:"design.docx"}.`,
      `**Example – Extract passport data**
USER: "I uploaded a passport PDF. Extract the details."
→ Tool = searchFiles; params = {query:"passport details including passport number, name, date of birth, nationality, expiry date"}.`
    );
  }
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
  if (registry.getAvailableCategories().includes("email")) {
    ex.push(
      `**Example – Email send**
USER: "Send an email to alice@example.com with subject 'Report' and body 'Here is the Q2 report'."
→ Tool = sendEmail; params = {to:["alice@example.com"], subject:"Report", body:"Here is the Q2 report"}.`,
      `**Example – Email search**
USER: "Find unread emails from bob@example.com this week."
→ Tool = searchEmails; params = {from:"bob@example.com", dateRange:{start:"2025-07-06", end:"2025-07-12"}, isRead:false}.`,
      `**Example – Email reply**
USER: "Reply to email_123 with 'Thanks for the update.'"
→ Tool = replyToEmail; params = {emailId:"email_123", body:"Thanks for the update."}.`
    );
  }
  if (registry.getAvailableCategories().includes("passport")) {
    ex.push(
      `**Example – Passport create**
USER: "Create passport for John Doe, number YA1234567, DOB 1990-04-21, nationality ITALIAN, expiry 2030-04-30"` +
        `
→ Tool = createPassport; params = {passport_number:"YA1234567", surname:"DOE", given_names:"JOHN", date_of_birth:"1990-04-21", nationality:"ITALIAN", date_of_expiry:"2030-04-30", /* other fields as needed */}.`,
      `**Example – Passport search**
USER: "Find passports for surname 'Smith' issued before 2021"` +
        `
→ Tool = getPassports; params = {surname:"Smith", date_of_issue:{end:"2021-01-01"}}. `,
      `**Example – Passport upload**
USER: "I just uploaded a passport scan. Extract the details and create a passport record."
→ Tool = createPassport; params = {passport_number:"<extracted>", surname:"<extracted>", given_names:"<extracted>", date_of_birth:"<extracted>", nationality:"<extracted>", date_of_expiry:"<extracted>", /* other fields from document */}.`
    );
  }
  if (registry.getAvailableCategories().includes("web")) {
    ex.push(
      `**Example – Web search**
USER: "What are the latest updates on AI regulation?"
→ Tool = searchWeb; params = {query:"latest updates on AI regulation"}.`,
      `**Example – Fetch page**
USER: "Fetch the content of https://example.com/data-report"
→ Tool = getWebPageContent; params = {url:"https://example.com/data-report"}.`,
      `**Example – Summarize page**
USER: "Summarize the article at https://news.site/article"
→ Tool = summarizeWebPage; params = {url:"https://news.site/article", maxLength:200}.`
    );
  }
  if (registry.getAvailableCategories().includes("synthesis")) {
    ex.push(
      `**Example – Synthesis summary**
USER: "Summarize the current conversation and tool outputs so far."
→ Tool = synthesizeChat; params = {userMessage:"Summarize the current conversation and tool outputs so far.", chatHistory:[...], toolCalls:[...], previousSteps:[...], model:"gpt-4.1"}.`
      // Note: This example is commented out because it is used automatically by the orchestrator as final step
      //       `**Example – Final synthesis**
      // USER: "Provide the final answer to the original user request based on all gathered data."
      // → Tool = synthesizeFinalAnswer; params = {userMessage:"Provide the final answer to the original user request based on all gathered data.", chatHistory:[...], toolCalls:[...], previousSteps:[...], model:"gpt-4.1"}.`
    );
  }

  return ex.join("\n\n") + "\n";
}

/**
 * Concrete CALL_TOOLS snippets the LLM can copy-paste.
 *
 * @deprecated
 */
export function generateToolExamples(
  registry: ToolRegistry,
  vectorStoreIds: string[]
): string {
  const rows: string[] = [];
  /* File-search tools */
  if (registry.getAvailableCategories().includes("file-search")) {
    // Standalone example: searchFiles only
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "searchFiles",\n    "parameters": { "query": "extract passport details including passport number name nationality date of birth expiry date" },\n    "reasoning": "Extract passport information from uploaded PDF document."\n  }\n]\n```',
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "getDocumentByName",\n    "parameters": { "name": "Passport_new_ext_05_apr_2032.pdf" },\n    "reasoning": "Retrieve specific passport document by filename."\n  }\n]\n```'
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

  /* Calendar */
  if (registry.getAvailableCategories().includes("calendar")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "searchEvents",\n    "parameters": {\n      "query": "project kickoff",\n      "timeRange": {"start": "2025-08-01T00:00:00Z", "end": "2025-08-31T23:59:59Z"}\n    },\n    "reasoning": "Need to list all kickoff meetings in August."\n  }\n]\n```'
    );
  }

  /* Synthesis tools */
  if (registry.getAvailableCategories().includes("synthesis")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "synthesizeChat",\n    "parameters": {\n      "userMessage": "Summarize the current conversation.",\n      "chatHistory": [...],\n      "toolCalls": [...],\n      "previousSteps": [...],\n      "model": "gpt-4.1"\n    },\n    "reasoning": "Provide a concise context summary for the next steps."\n  }\n]\n```'
    );
  }

  /* Passport */
  if (registry.getAvailableCategories().includes("passport")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "createPassport",\n    "parameters": {\n      "passport_number": "YA1234567",\n      "surname": "DOE",\n      "given_names": "JOHN",\n      "nationality": "ITALIAN",\n      "date_of_birth": "1990-04-21",\n      "sex": "M",\n      "place_of_birth": "ROME",\n      "date_of_issue": "2020-05-01",\n      "date_of_expiry": "2030-04-30",\n      "issuing_authority": "ROME POLICE",\n      "holder_signature_present": true,\n      "type": "passport"\n    },\n    "reasoning": "Store extracted passport into DB."\n  }\n]\n```'
    );
  }
  /* Email tools */
  if (registry.getAvailableCategories().includes("email")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "sendEmail",\n    "parameters": { "emailData": { "to": ["bob@example.com"], "subject": "Meeting Notes", "body": "Here are the meeting notes." } },\n    "reasoning": "Send meeting notes to Bob."\n  },\n  {\n    "name": "searchEmails",\n    "parameters": { "filters": { "from": "alice@example.com", "isRead": false } },\n    "reasoning": "Find unread emails from Alice."\n  },\n  {\n    "name": "getEmail",\n    "parameters": { "emailId": "email_1" },\n    "reasoning": "Retrieve details of a specific email."\n  },\n  {\n    "name": "replyToEmail",\n    "parameters": { "emailId": "email_2", "replyData": { "body": "Thank you for the update.", "replyAll": true } },\n    "reasoning": "Reply to the email with a thank-you message."\n  },\n  {\n    "name": "markEmail",\n    "parameters": { "emailId": "email_1", "action": "read" },\n    "reasoning": "Mark the email as read."\n  }\n]\n```'
    );
  }
  /* Web tools */
  if (registry.getAvailableCategories().includes("web")) {
    rows.push(
      '```json\nCALL_TOOLS:\n[\n  {\n    "name": "searchWeb",\n    "parameters": { "query": "AI regulation updates" },\n    "reasoning": "Get latest online information about AI regulation."\n  },\n  {\n    "name": "getWebPageContent",\n    "parameters": { "url": "https://example.com/report" },\n    "reasoning": "Fetch full content of the example report page."\n  },\n  {\n    "name": "summarizeWebPage",\n    "parameters": { "url": "https://news.site/article", "maxLength": 150 },\n    "reasoning": "Provide a concise summary of the given article."\n  }\n]\n```'
    );
  }

  return ["**EXAMPLE CALL_TOOLS BLOCKS**", ...rows].join("\n\n") + "\n";
}

/**
 * A one-shot ordered list telling the model which categories are more
 * important when several could apply.
 */
export function generatePriorityOrder(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const parts: string[] = ["**CATEGORY PRIORITY**"];

  if (cat.includes("file-search")) parts.push("1. File search tools");
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch"))
    parts.push(`${parts.length}. 2. Knowledge (vectorFileSearch)`);
  if (cat.includes("calendar")) parts.push("1. Calendar tools");
  if (cat.includes("passport")) parts.push(`${parts.length}. Passport`);
  if (cat.includes("email")) parts.push(`${parts.length}. Email`);
  if (cat.includes("web")) parts.push(`${parts.length}. Web`);

  return parts.join("\n") + "\n";
}

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
      `${n++}. **Documentation / visa / policy / general knowledge** → use \`vectorFileSearch\`. Include the \`vectorStoreIds\` array every time.`
    );
  }

  if (cat.includes("passport")) {
    rules.push(
      `${n++}. **Passport image / data operations** → use passport tools (\`createPassport\`, \`getPassports\`, etc.).`
    );
  }

  if (cat.includes("email")) {
    rules.push(
      `${n++}. **Email operations** → use email tools (\`sendEmail\`, \`getEmails\`, etc.).`
    );
  }

  if (cat.includes("file-search")) {
    rules.push(
      `${n++}. **File search** → use \`searchFiles\` with a descriptive \`query\` parameter. Do not use \`files\` parameter.`,
      `${n++}. **Get document by name** → use \`getDocumentByName\` with the exact filename to retrieve the document from the database.`
    );
  }

  rules.push(
    `${n++}. If unsure which tool yields the required info, ask for clarification.`,
    `${n++}. If no tool can help and you have sufficient info to answer user's question, reply with **SUFFICIENT_INFO** explaining why.`
  );

  return `**DECISION RULES**\n${rules.map((r) => `- ${r}`).join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/* OPTIMIZED PROMPT FUNCTIONS (SHORTER & FASTER)                      */
/* ------------------------------------------------------------------ */

/**
 * Compact tool listing with only essential information.
 */
function listToolsCompact(registry: ToolRegistry): string {
  return registry
    .getAvailableCategories()
    .map((category) => {
      const items = registry
        .getToolsByCategory(category)
        .map(
          (t) =>
            `  • ${t.name}: ${
              t.description
            } ${utils.getCompactToolParameterInfo(t.name)}`
        )
        .join("\n");
      return `**${category.toUpperCase()}**\n${items}`;
    })
    .join("\n\n");
}

/**
 * Essential decision rules only.
 */
export function generateCompactRules(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const rules: string[] = [];

  if (cat.includes("calendar"))
    rules.push("- Calendar queries → use searchEvents/getEvents first");
  if (cat.includes("file-search"))
    rules.push("- File operations → use searchFiles with query parameter");
  if (cat.includes("passport"))
    rules.push("- Passport data → use passport tools, translate to English");
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    rules.push("- Knowledge queries → use vectorFileSearch");
  }
  rules.push("- If unsure → ask for clarification");

  return rules.join("\n");
}

/**
 * Essential examples only - maximum 3 per category.
 */
export function generateCompactExamples(registry: ToolRegistry): string {
  const cat = registry.getAvailableCategories();
  const examples: string[] = [];

  if (cat.includes("file-search")) {
    examples.push('searchFiles: {query: "extract passport details"}');
  }
  if (cat.includes("calendar")) {
    examples.push('searchEvents: {query: "meetings", timeRange: {...}}');
  }
  if (cat.includes("passport")) {
    examples.push('createPassport: {passport_number: "...", surname: "..."}');
  }
  if (cat.includes("email")) {
    examples.push(
      'sendEmail: {to: ["<user_email>"], subject: "...", body: "..."}'
    );
  }
  if (registry.getAvailableTools().some((t) => t.name === "vectorFileSearch")) {
    examples.push(
      'vectorFileSearch: {query: "visa requirements", vectorStoreIds: [...] }'
    );
  }
  if (cat.includes("web")) {
    examples.push('searchWeb: {query: "latest AI news"}');
  }

  return examples.length > 0 ? `**EXAMPLES**: ${examples.join(" | ")}` : "";
}

/**
 * Ultra-compact planner prompt - reduces size by ~80%.
 */
export const buildCompactPlannerPrompt = (
  chatHistory: string,
  userMessage: string,
  fileInfo: string,
  registry: ToolRegistry
) => `
ROLE: StrategistGPT - Tool Planning Agent

RULES:
1. Write SCRATCHPAD with reasoning
2. Output PLAN_JSON array: [{"step_n": 1, "purpose": "...", "tool": "exact_name", "success": "..."}]
3. Each step = one tool
4. End with SELF_CHECK: "OK" or list issues

CONTEXT:
${chatHistory ? `HISTORY: ${chatHistory.slice(0, 500)}...` : ""}
REQUEST: "${userMessage}" ${fileInfo}

TOOLS:
${listToolsCompact(registry)}

RULES:
${generateCompactRules(registry)}

${generateCompactExamples(registry)}

OUTPUT:
### SCRATCHPAD
• [reasoning bullets]

### PLAN_JSON
[the array]

### SELF_CHECK
[OK or issues]
`;

/**
 * Build the planner prompt for the orchestrator.
 * @param chatHistory - The chat history to include in the prompt.
 * @param userMessage - The user's message to process.
 * @param fileInfo - Information about any files involved.
 * @param categorizedTools - The available tools categorized.
 * @param analysisInstr - Instructions for analysis.
 * @param ctxInstr - Context instructions.
 * @param examples - Example analyses to guide the model.
 */
export const buildPlannerPrompt = (
  chatHistory: string,
  userMessage: string,
  fileInfo: string,
  categorizedTools: string,
  analysisInstr: string,
  ctxInstr: string,
  examples: string
) => `
SYSTEM_DATE: ${new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
})}

ROLE
You are **StrategistGPT**, an LLM that designs executable plans for the Tool-Orchestrator.

RULES
1. FIRST write a SCRATCHPAD section with your private chain-of-thought.
2. Then output PLAN_JSON – a valid JSON array where each item follows the schema:
   {
     "step_n": <int>,
     "purpose": "<one-sentence goal>",
     "tool": "<exact tool_name from AVAILABLE_TOOLS>",
     "success": "<how to verify success>"
   }
3. Every plan step MUST invoke exactly one tool.
4. After the plan, output exactly this:
---
### AT EVERY STEP, BEFORE CALLING A TOOL
- Do not proceed to the next step if the previous step does not succeed.
- If a step fails twice consecutively, terminate the workflow and reply that: THE WORKFLOW IS TERMINATED DUE TO ERRORS.
---
5. After the plan, output SELF_CHECK: “OK” if every step has a tool; otherwise list issues.


CONTEXT
---CHAT_HISTORY---
${chatHistory}
---END CHAT_HISTORY---

USER_REQUEST: "${userMessage}" ${fileInfo}

AVAILABLE_TOOLS
${categorizedTools}

${analysisInstr}
${ctxInstr}
${examples}

OUTPUT FORMAT (exactly):
### SCRATCHPAD
<bulletised reasoning here>

### PLAN_JSON
<the JSON array>

### COMPLEXITY_SUMMARY
<≤20 words describing difficulty & risks>

### AT EVERY STEP, BEFORE CALLING A TOOL
- Do not proceed to the next step if the previous step does not succeed.
- If a step fails twice consecutively, terminate the workflow and reply that: THE WORKFLOW IS TERMINATED DUE TO ERRORS.

### SELF_CHECK
<see Rule 5>
`;
