import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ModelType } from '../config/models';
import { ToolExecution, ToolRegistry } from '../tools/tool-registry';

export interface OrchestrationStep {
  id: string;
  type: 'analysis' | 'tool_call' | 'evaluation' | 'synthesis';
  timestamp: number;
  content: string;
  toolExecution?: ToolExecution;
  reasoning?: string;
}

export interface OrchestrationResult {
  success: boolean;
  finalAnswer: string;
  steps: OrchestrationStep[];
  toolCalls: ToolExecution[];
  error?: string;
}

export interface OrchestratorConfig {
  maxSteps?: number;
  maxToolCalls?: number;
  developmentMode?: boolean;
}

export class ToolOrchestrator {
  private apiKey: string;
  private openaiClient: ReturnType<typeof createOpenAI>;
  private openrouterClient?: ReturnType<typeof createOpenAI>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openaiClient = createOpenAI({
      apiKey: apiKey,
    });

    // Initialize OpenRouter client if API key is available
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (openrouterApiKey) {
      this.openrouterClient = createOpenAI({
        apiKey: openrouterApiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
    }
  }

  private getProviderClient(model: ModelType) {
    // Determine provider based on model
    if (model.includes('/') || model.includes(':')) {
      // OpenRouter model format (e.g., "deepseek/deepseek-chat-v3-0324:free")
      if (!this.openrouterClient) {
        throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment variables.');
      }
      return this.openrouterClient;
    }

    // Default to OpenAI for standard models
    return this.openaiClient;
  }

  async orchestrate(
    userMessage: string,
    toolRegistry: ToolRegistry,
    model: ModelType = 'gpt-4o-mini',
    config: OrchestratorConfig = {}
  ): Promise<OrchestrationResult> {
    const {
      maxSteps = 10,
      maxToolCalls = 5,
      developmentMode = false
    } = config;

    const steps: OrchestrationStep[] = [];
    const toolCalls: ToolExecution[] = [];
    let currentStepId = 1;

    try {
      // Step 1: Initial analysis
      const analysisStep = await this.performAnalysis(userMessage, toolRegistry, model, currentStepId++);
      steps.push(analysisStep);

      let needsMoreInformation = true;
      let currentContext = userMessage;
      let toolCallCount = 0;

      // Iterative tool calling and evaluation
      while (needsMoreInformation && steps.length < maxSteps && toolCallCount < maxToolCalls) {
        // Step 2: Determine what tools to call
        const toolDecisionStep = await this.decideToolUsage(
          currentContext,
          toolRegistry,
          toolCalls,
          model,
          currentStepId++
        );
        steps.push(toolDecisionStep);

        // Parse tool decisions and execute tools
        const toolsToCall = this.parseToolDecisions(toolDecisionStep.content);

        if (toolsToCall.length === 0) {
          needsMoreInformation = false;
          break;
        }

        // Execute tools
        for (const toolCall of toolsToCall) {
          if (toolCallCount >= maxToolCalls) break;

          const startTime = Date.now();
          const result = await toolRegistry.executeTool(toolCall.name, toolCall.parameters);
          const endTime = Date.now();

          const execution: ToolExecution = {
            tool: toolCall.name,
            parameters: toolCall.parameters,
            result,
            startTime,
            endTime,
            duration: endTime - startTime
          };

          toolCalls.push(execution);
          toolCallCount++;

          // Add tool execution step
          steps.push({
            id: `step_${currentStepId++}`,
            type: 'tool_call',
            timestamp: Date.now(),
            content: `Executed tool: ${toolCall.name}`,
            toolExecution: execution,
            reasoning: `Called ${toolCall.name} with parameters: ${JSON.stringify(toolCall.parameters)}`
          });
        }

        // Step 3: Evaluate if we have enough information
        const evaluationStep = await this.evaluateProgress(
          userMessage,
          currentContext,
          toolCalls,
          model,
          currentStepId++
        );
        steps.push(evaluationStep);

        // Update context with tool results
        currentContext = this.buildUpdatedContext(userMessage, toolCalls);

        // Check if evaluation indicates we have enough information
        needsMoreInformation = this.needsMoreInformation(evaluationStep.content);

        // Special validation for calendar queries - ensure tools were actually called
        if (!needsMoreInformation && this.isCalendarQuery(userMessage)) {
          const hasSuccessfulCalendarTools = toolCalls.some(call =>
            (call.tool === 'searchEvents' || call.tool === 'getEvents') && call.result.success
          );

          const hasAttemptedCalendarTools = toolCalls.some(call =>
            call.tool === 'searchEvents' || call.tool === 'getEvents'
          );

          // Force continuation if no calendar tools were attempted at all, but only if we haven't hit limits
          if (!hasAttemptedCalendarTools && toolCallCount < maxToolCalls && steps.length < maxSteps) {
            needsMoreInformation = true;
            console.log('🔄 Forcing tool retry for calendar query - no calendar tools attempted yet');
          } else if (!hasSuccessfulCalendarTools && hasAttemptedCalendarTools) {
            // Tools were attempted but failed - this is acceptable if handled gracefully
            console.log('⚠️ Calendar tools attempted but failed - proceeding with error explanation');
          } else if (!hasAttemptedCalendarTools) {
            // We've hit limits without attempting calendar tools
            console.log('⚠️ Calendar query completed without attempting calendar tools due to limits reached');
          }
        }
      }

      // Iterative synthesis with format validation
      let synthesisStep = await this.synthesizeFinalAnswer(
        userMessage,
        currentContext,
        toolCalls,
        model,
        currentStepId++
      );
      steps.push(synthesisStep);

      // Check if synthesis matches user intent and iterate if needed
      const maxSynthesisIterations = 3;
      let synthesisIterations = 1;

      while (synthesisIterations < maxSynthesisIterations) {
        const formatValidation = await this.validateResponseFormat(
          userMessage,
          synthesisStep.content,
          model,
          currentStepId++
        );
        steps.push(formatValidation);

        if (this.isFormatAcceptable(formatValidation.content)) {
          break;
        }

        // Refine synthesis based on validation feedback
        synthesisStep = await this.refineSynthesis(
          userMessage,
          currentContext,
          toolCalls,
          synthesisStep.content,
          formatValidation.content,
          model,
          currentStepId++
        );
        steps.push(synthesisStep);
        synthesisIterations++;
      }

      return {
        success: true,
        finalAnswer: synthesisStep.content,
        steps: developmentMode ? steps : steps.filter(step => step.type === 'synthesis'),
        toolCalls
      };

    } catch (error) {
      return {
        success: false,
        finalAnswer: "I encountered an error while processing your request. Please try again.",
        steps: developmentMode ? steps : [],
        toolCalls,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async performAnalysis(
    userMessage: string,
    toolRegistry: ToolRegistry,
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const availableCategories = toolRegistry.getAvailableCategories();
    const categorizedToolsList = availableCategories
      .map(category => {
        const tools = toolRegistry.getToolsByCategory(category);
        return `**${category.toUpperCase()}**:\n${tools.map(tool => `  - ${tool.name}: ${tool.description}`).join('\n')}`;
      }).join('\n\n');

    const prompt = `
Today is ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}.

You are an intelligent assistant capable of multi-step reasoning and tool orchestration. Your task is to analyze user requests and develop a strategic approach.

User Request: "${userMessage}"

Available Tools by Category:
${categorizedToolsList}

Perform a comprehensive analysis:

## 1. REQUEST DECOMPOSITION
Break down the user's request into:
- Primary objective(s)
- Required information or actions
- Potential sub-tasks or dependencies

## 2. TOOL STRATEGY
For each objective, identify:
- Which tool categories are most relevant
- Specific tools that might be needed
- Optimal sequence of tool calls
- Dependencies between tools

## 3. INFORMATION REQUIREMENTS
Determine what information you need to gather:
- Direct answers to user questions
- Context needed for subsequent actions
- Validation data for proposed changes

## 4. APPROACH PLAN
Outline your planned approach:
- Initial information gathering steps
- Decision points where you'll evaluate progress
- Contingency plans for common failure scenarios
- Expected final deliverable format

## 5. COMPLEXITY ASSESSMENT
Evaluate the request complexity:
- Simple (single tool call)
- Moderate (2-3 related tool calls)
- Complex (multiple iterations with conditional logic)
- Advanced (cross-category tool coordination)

Provide a clear, structured analysis that will guide the tool orchestration process.
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.1 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'analysis',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Comprehensive analysis of user request and strategic tool planning'
    };
  }

  private async decideToolUsage(
    context: string,
    toolRegistry: ToolRegistry,
    previousToolCalls: ToolExecution[],
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const availableCategories = toolRegistry.getAvailableCategories();
    const categorizedToolsList = availableCategories
      .map(category => {
        const tools = toolRegistry.getToolsByCategory(category);
        return `**${category.toUpperCase()}**:\n${tools.map(tool =>
          `  - ${tool.name}: ${tool.description}\n    Parameters: [Structured object with validation]`
        ).join('\n')}`;
      }).join('\n\n');

    const previousCallsContext = previousToolCalls.length > 0
      ? `\nPrevious tool calls and results:\n${previousToolCalls.map(call => {
          const result = typeof call.result.data === 'object'
            ? JSON.stringify(call.result.data, null, 2).substring(0, 500) + '...'
            : call.result.data;
          return `${call.tool}(${JSON.stringify(call.parameters)}): ${call.result.success ? 'SUCCESS' : 'FAILED'}\n  Result: ${result}\n  Message: ${call.result.message || 'N/A'}`;
        }).join('\n\n')}`
      : '';

    const prompt = `
Today is ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}.

You are an intelligent tool orchestrator with REAL ACCESS to live data through tools. You are NOT limited to training data.

## IMPORTANT: YOU HAVE LIVE DATA ACCESS
- Calendar tools provide REAL Google Calendar data for ANY date range including future dates
- Search tools can find CURRENT information
- You can access events, meetings, and calendar data for 2025 and beyond
- DO NOT assume you lack access to information - check with tools first

## CONTEXT
${context}${previousCallsContext}

## AVAILABLE TOOLS
${categorizedToolsList}

## DECISION FRAMEWORK

### 1. EVALUATE CURRENT STATE
- What information has been gathered so far?
- What gaps remain in answering the user's request?
- Are there any failed tool calls that need retry or alternative approaches?

### 2. STRATEGIC TOOL SELECTION
- Which tools would provide the most valuable information next?
- What's the optimal sequence for maximum efficiency?
- Are there dependencies between tools that need to be respected?

### 3. PARAMETER PLANNING
- What specific parameters should be used for each tool?
- How can previous results inform parameter selection?
- What filters or constraints would improve results?

## RESPONSE FORMAT

If you need to call tools, respond with:
\`\`\`json
CALL_TOOLS:
[
  {
    "name": "toolName",
    "parameters": { /* well-structured parameters */ },
    "reasoning": "Why this tool with these parameters is needed"
  }
]
\`\`\`

If you have sufficient information, respond with:
\`\`\`
SUFFICIENT_INFO: Explanation of why no more tools are needed
\`\`\`

## TOOL USAGE GUIDELINES

- **Calendar Tools**: Use time ranges and filters strategically for ANY date range
  - For queries about specific companies/projects (like "nespola"), use searchEvents with the company name as query
  - Always include time ranges when specified (e.g., "march to june 2025" = timeRange: start "2025-03-01", end "2025-06-30")
  - Use ISO date format for time ranges: "2025-03-01T00:00:00Z" to "2025-06-30T23:59:59Z"
- **Search Operations**: Use specific queries for better results
- **Create/Update Operations**: Ensure all required data is available
- **Iterative Refinement**: Use previous results to refine subsequent calls

## CRITICAL GUIDELINES FOR CALENDAR QUERIES

**When user asks about events for a specific company/client (e.g., "nespola"):**
1. Use searchEvents tool with the company name as query parameter
2. Include the specified date range in timeRange parameter
3. Example for "events for nespola between march and june 2025":
   Use searchEvents with query="nespola" and timeRange start="2025-03-01T00:00:00Z", end="2025-06-30T23:59:59Z"

## CRITICAL REMINDER
When users ask about future events or specific date ranges, ALWAYS use calendar tools to check for real data first.
Do NOT assume you lack access to information without trying the tools.

## IMMEDIATE ACTION REQUIRED FOR CALENDAR QUERIES

**CRITICAL**: For calendar-related questions, you MUST call calendar tools immediately. Do not try to answer from general knowledge.

**For queries about specific companies/projects (like "italmagneti", "nespola"):**
1. FIRST ATTEMPT: Use searchEvents with the company name as query parameter
2. Include the specified date range in timeRange parameter
3. Example: For "holistic vision of project for italmagneti":
   - Use searchEvents with query="italmagneti"
   - Include broad timeRange like start="2024-01-01T00:00:00Z", end="2025-12-31T23:59:59Z"

**For general calendar queries:**
1. Use getEvents with appropriate time range
2. If that doesn't work, use searchEvents with relevant keywords

Provide your reasoning and decision.
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.1 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'evaluation',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Strategic tool selection and parameter planning'
    };
  }

  private async evaluateProgress(
    originalMessage: string,
    currentContext: string,
    toolCalls: ToolExecution[],
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const toolResults = toolCalls.map(call => {
      const duration = call.duration;
      const status = call.result.success ? '✅ SUCCESS' : '❌ FAILED';
      const data = call.result.data ?
        (typeof call.result.data === 'object' ?
          JSON.stringify(call.result.data, null, 2).substring(0, 800) + (JSON.stringify(call.result.data).length > 800 ? '...' : '') :
          call.result.data) :
        'No data';

      return `## ${call.tool} (${duration}ms) ${status}
Parameters: ${JSON.stringify(call.parameters, null, 2)}
Result: ${data}
Message: ${call.result.message || 'N/A'}
${call.result.error ? `Error: ${call.result.error}` : ''}`;
    }).join('\n\n');

    const prompt = `
## PROGRESS EVALUATION TASK

**Original User Request:** "${originalMessage}"

**Current Tool Execution Results:**
${toolResults}

## EVALUATION CRITERIA

### 1. MANDATORY TOOL EXECUTION CHECK
- For calendar-related queries, have we called calendar tools (searchEvents, getEvents)?
- If initial tool calls failed or returned insufficient data, have we tried alternative parameters?
- CRITICAL: If no relevant tools have been successfully executed, we MUST continue with retry attempts

### 2. DATA SUFFICIENCY ASSESSMENT
- Have we gathered sufficient REAL data from tool executions to answer the user's request?
- Are there any critical gaps in the data we've collected from tools?
- Do the tool results directly address what the user asked for?

### 3. RETRY STRATEGY EVALUATION
- If tools returned no/insufficient data, should we retry with:
  - Broader search terms?
  - Extended date ranges?
  - Different tool combinations?
- Have we exhausted reasonable retry options?

### 4. QUALITY VALIDATION
- Are the results from tools accurate and relevant?
- Do any tool calls need to be retried with different parameters?
- Are there any error conditions that need to be addressed?

## DECISION FRAMEWORK

**STRICT RULE: For calendar queries, we CANNOT complete without successful tool execution that returns relevant data**

Consider these factors:
- **Tool Execution**: Have calendar tools been called and returned useful data?
- **User Intent**: Does our retrieved data align with what they actually wanted?
- **Information Depth**: Is the tool-retrieved response sufficiently detailed?
- **Retry Potential**: Could different parameters yield better results?

## RESPONSE FORMAT

If you need more information, respond with:
\`\`\`
CONTINUE: [Detailed explanation of what additional information is needed and why]
\`\`\`

If you have sufficient information, respond with:
\`\`\`
COMPLETE: [Explanation of why the current information is sufficient to provide a comprehensive answer]
\`\`\`

Provide detailed reasoning for your decision.
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.1 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'evaluation',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Comprehensive evaluation of information completeness and next steps'
    };
  }

  private async synthesizeFinalAnswer(
    userMessage: string,
    context: string,
    toolCalls: ToolExecution[],
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const toolResults = toolCalls.map(call => {
      const summary = call.result.success ?
        `✅ **${call.tool}** completed successfully` :
        `❌ **${call.tool}** failed`;

      const timing = ` (${call.duration}ms)`;
      const data = call.result.data ?
        (typeof call.result.data === 'object' ?
          JSON.stringify(call.result.data, null, 2) :
          call.result.data) :
        'No data returned';

      return `${summary}${timing}
**Parameters:** ${JSON.stringify(call.parameters, null, 2)}
**Result:** ${data}
**Message:** ${call.result.message || 'N/A'}
${call.result.error ? `**Error:** ${call.result.error}` : ''}`;
    }).join('\n\n---\n\n');

    const prompt = `
## RESPONSE SYNTHESIS TASK

**User's Original Request:** "${userMessage}"

**Complete Tool Execution Summary:**
${toolResults}

## SYNTHESIS REQUIREMENTS

### 1. COMPREHENSIVE RESPONSE
Create a helpful, conversational response that:
- Directly addresses the user's specific request
- Incorporates all relevant information gathered from tools
- Provides clear, actionable information
- Uses a friendly and professional tone

### 2. MARKDOWN FORMATTING REQUIREMENTS

**CRITICAL**: Your response MUST be properly formatted using Markdown syntax:

**For Calendar Events and Data:**
- Use ## Events Summary for [Company/Project] ([Date Range]) for main headings
- Use ### Event Title for individual event headings
- Use **Bold text** for important labels like Date, Description, Status, Duration
- Use bullet points with - for lists of items
- Use numbered lists with 1. for sequential information
- Use > for blockquotes when highlighting important information

**For Structured Information:**
- Use proper heading hierarchy: #, ##, ###
- Use **Bold** for field labels and important information
- Use - for unordered lists (bullet points)
- Use 1. for ordered lists (numbered items)
- Use code blocks with triple backticks for any technical details or IDs
- Use *Italic* for emphasis and secondary information

**Example Structure:**
## Events Summary for [Company/Project] ([Date Range])

### [Event Title]
**Date:** [Actual date from tool results]
**Description:** [Actual description from calendar data]
**Status:** [Actual status from tools]

## Summary
[Based only on retrieved data from tools]

## Important Note
All information above comes from actual calendar data retrieved by tools. If no relevant events were found, this will be clearly stated.

### 3. RESPONSE STRUCTURE
- Lead with a direct answer to the user's question
- Use proper markdown headings and formatting throughout
- Provide detailed information in a logical, well-structured order
- End with any relevant next steps or additional information
- Ensure all lists use proper markdown bullet points or numbering

## QUALITY STANDARDS
- **MANDATORY TOOL USAGE**: NEVER provide information without first attempting to retrieve it via tools
- **RETRY REQUIREMENT**: If initial tool calls fail or return insufficient data, try alternative parameters or different tools
- **NO FABRICATION**: Only use information that was actually retrieved from tool executions
- **DATA VALIDATION**: If no relevant data is found, explicitly state this rather than making assumptions
- **Accuracy**: Only include information that was actually retrieved/confirmed from tool calls
- **Completeness**: Address all aspects of the user's request using only retrieved data
- **Clarity**: Use clear language and avoid technical jargon
- **Helpfulness**: Provide context and actionable information based on real data
- **Formatting**: Use proper markdown syntax for headings, lists, bold text, etc.

## CRITICAL RULE
If tools were not called or returned no relevant data, you MUST state that no information was found rather than generating any content. NEVER make up or fabricate information.

Create your comprehensive, well-formatted markdown response below:
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.3 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'synthesis',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Comprehensive synthesis of all gathered information into a user-friendly response'
    };
  }

  private async validateResponseFormat(
    userMessage: string,
    synthesizedResponse: string,
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const prompt = `
## RESPONSE FORMAT VALIDATION TASK

**User's Original Request:** "${userMessage}"

**Generated Response:**
${synthesizedResponse}

## VALIDATION CRITERIA

Analyze whether the generated response properly matches the user's intent and request format:

### 1. REQUEST TYPE DETECTION
Determine what type of response the user wanted:
- **HOLISTIC SUMMARY**: User wants a high-level project summary, overall analysis, or synthesized overview
  - Keywords: "summary", "overview", "how is", "status of", "overall", "in general", "tell me about"
  - Expected format: Integrated narrative, project status, overall insights
- **DETAILED BREAKDOWN**: User wants specific event listings, detailed schedules, or itemized information
  - Keywords: "list", "show", "events", "schedule", "what meetings", "when is"
  - Expected format: Individual events, specific dates/times, structured lists

### 2. FORMAT MATCH ANALYSIS
Check if the response format aligns with the detected request type:
- Does a holistic request get a holistic response (not just event lists)?
- Does a detailed request get proper event breakdowns?
- Is the tone and structure appropriate for the request type?

### 3. CONTENT QUALITY ASSESSMENT
- Does the response synthesize information appropriately?
- Is it conversational and helpful?
- Does it provide actionable insights or just raw data?

## RESPONSE FORMAT

If the format matches the user's intent, respond with:
\`\`\`
FORMAT_ACCEPTABLE: The response properly addresses the user's request with appropriate format and content structure.
\`\`\`

If the format needs improvement, respond with:
\`\`\`
FORMAT_NEEDS_REFINEMENT: [Detailed explanation of what needs to be improved]

REQUIRED_CHANGES:
- [Specific change 1]
- [Specific change 2]
- [Specific change 3]

EXPECTED_FORMAT: [Description of what the ideal response should look like]
\`\`\`

Provide your detailed analysis below:
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.1 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'evaluation',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Validation of response format alignment with user intent'
    };
  }

  private async refineSynthesis(
    userMessage: string,
    context: string,
    toolCalls: ToolExecution[],
    previousSynthesis: string,
    validationFeedback: string,
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const toolResults = toolCalls.map(call => {
      const summary = call.result.success ?
        `✅ **${call.tool}** completed successfully` :
        `❌ **${call.tool}** failed`;

      const timing = ` (${call.duration}ms)`;
      const data = call.result.data ?
        (typeof call.result.data === 'object' ?
          JSON.stringify(call.result.data, null, 2) :
          call.result.data) :
        'No data returned';

      return `${summary}${timing}
**Parameters:** ${JSON.stringify(call.parameters, null, 2)}
**Result:** ${data}
**Message:** ${call.result.message || 'N/A'}
${call.result.error ? `**Error:** ${call.result.error}` : ''}`;
    }).join('\n\n---\n\n');

    const prompt = `
## RESPONSE REFINEMENT TASK

**User's Original Request:** "${userMessage}"

**Previous Response:**
${previousSynthesis}

**Validation Feedback:**
${validationFeedback}

**Available Data from Tools:**
${toolResults}

## REFINEMENT INSTRUCTIONS

Based on the validation feedback, create an improved response that:

### 1. ADDRESSES FEEDBACK POINTS
- Fix the specific issues identified in the validation
- Adjust the format to match user expectations
- Improve content structure and tone

### 2. RESPONSE TYPE OPTIMIZATION

**For HOLISTIC SUMMARY requests:**
- Create an integrated narrative about the project/topic
- Synthesize patterns and insights from the data
- Provide project status, progress overview, and key highlights
- Use conversational, analytical tone
- Structure: Introduction → Key Insights → Overall Status → Recommendations/Next Steps

**For DETAILED BREAKDOWN requests:**
- List specific events with proper formatting
- Include dates, times, descriptions, and relevant details
- Use structured markdown with headings and bullet points
- Organize chronologically or by category

### 3. ENHANCED SYNTHESIS GUIDELINES

**Holistic Summary Example Structure:**
\`\`\`
## Project Overview: [Project Name]

Based on my review of your calendar data from [time period], here's an overview of the [project/topic]:

**Key Highlights:**
- [Major accomplishment or pattern]
- [Important milestone or trend]
- [Notable observation]

**Current Status:**
[Integrated analysis of recent activities and progress]

**Insights:**
[Synthesized observations about workload, focus areas, or patterns]

**Looking Ahead:**
[Recommendations or observations about upcoming work]
\`\`\`

### 4. QUALITY STANDARDS
- **Clarity**: Use clear, conversational language
- **Relevance**: Focus on what matters to the user
- **Actionability**: Provide useful insights or next steps
- **Formatting**: Use proper markdown for readability
- **Tone**: Match the appropriate level of formality

Create your refined response below:
`;

    const client = this.getProviderClient(model);
    const supportsTemperature = !['o4-mini', 'o4-mini-high', 'o3', 'o3-mini'].includes(model);

    const response = await generateText({
      model: client.languageModel(model),
      messages: [{ role: 'user', content: prompt }],
      ...(supportsTemperature && { temperature: 0.3 }),
    });

    return {
      id: `step_${stepId}`,
      type: 'synthesis',
      timestamp: Date.now(),
      content: response.text,
      reasoning: 'Refined synthesis based on format validation feedback'
    };
  }

  private parseToolDecisions(content: string): Array<{ name: string; parameters: Record<string, unknown> }> {
    try {
      // Look for CALL_TOOLS: section with JSON
      const callToolsMatch = content.match(/CALL_TOOLS:\s*```json\s*(\[[\s\S]*?\])\s*```/);
      if (callToolsMatch) {
        const toolsJson = callToolsMatch[1];
        const tools = JSON.parse(toolsJson);
        if (Array.isArray(tools)) {
          return tools.map(tool => ({
            name: tool.name,
            parameters: tool.parameters
          }));
        }
      }

      // Fallback: Look for CALL_TOOLS: without code blocks
      const fallbackMatch = content.match(/CALL_TOOLS:\s*(\[[\s\S]*?\])/);
      if (fallbackMatch) {
        const toolsJson = fallbackMatch[1];
        const tools = JSON.parse(toolsJson);
        if (Array.isArray(tools)) {
          return tools.map(tool => ({
            name: tool.name,
            parameters: tool.parameters
          }));
        }
      }

      // Additional fallback: Look for tools in any JSON array format
      const jsonArrayMatch = content.match(/(\[[\s\S]*?\])/);
      if (jsonArrayMatch) {
        try {
          const tools = JSON.parse(jsonArrayMatch[1]);
          if (Array.isArray(tools) && tools.length > 0 && tools[0].name) {
            return tools.map(tool => ({
              name: tool.name,
              parameters: tool.parameters
            }));
          }
        } catch {
          // Ignore parsing errors for non-tool JSON
        }
      }
    } catch (error) {
      console.error('Error parsing tool decisions:', error);
    }

    return [];
  }

  private needsMoreInformation(evaluationContent: string): boolean {
    // Check for explicit CONTINUE pattern
    if (evaluationContent.includes('CONTINUE:')) {
      return true;
    }

    // Check for COMPLETE pattern
    if (evaluationContent.includes('COMPLETE:')) {
      return false;
    }

    // Fallback to text analysis
    const lowerContent = evaluationContent.toLowerCase();
    const continueIndicators = [
      'continue',
      'more information needed',
      'additional tools',
      'need more',
      'insufficient',
      'call more tools',
      'further investigation',
      'retry',
      'broader search',
      'no relevant data',
      'no events found',
      'failed to find'
    ];

    const completeIndicators = [
      'sufficient data retrieved',
      'successfully retrieved',
      'found relevant events',
      'calendar data obtained',
      'tools returned useful data'
    ];

    const hasIncompleteIndicators = continueIndicators.some(indicator =>
      lowerContent.includes(indicator)
    );

    const hasCompleteIndicators = completeIndicators.some(indicator =>
      lowerContent.includes(indicator)
    );

    // If we have explicit complete indicators and no incomplete ones, we're done
    if (hasCompleteIndicators && !hasIncompleteIndicators) {
      return false;
    }

    // If we have incomplete indicators, continue
    if (hasIncompleteIndicators) {
      return true;
    }

    // Default to complete if unclear
    return false;
  }

  private buildUpdatedContext(userMessage: string, toolCalls: ToolExecution[]): string {
    const toolResults = toolCalls.map(call =>
      `${call.tool}: ${JSON.stringify(call.result, null, 2)}`
    ).join('\n');

    return `
Original request: ${userMessage}

Information gathered:
${toolResults}
`;
  }

  private isFormatAcceptable(validationContent: string): boolean {
    return validationContent.includes('FORMAT_ACCEPTABLE');
  }

  private isCalendarQuery(userMessage: string): boolean {
    const calendarKeywords = [
      'events', 'meetings', 'calendar', 'schedule', 'appointment',
      'italmagneti', 'nespola', 'project', 'work', 'daily report',
      'show me', 'list', 'find', 'search', 'when', 'what meetings',
      'holistic vision', 'summary', 'overview'
    ];

    const messageLower = userMessage.toLowerCase();
    return calendarKeywords.some(keyword => messageLower.includes(keyword));
  }
}
