import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ModelType } from '../appconfig/models';
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
  fileProcessingUsed?: boolean;
}

export interface OrchestratorConfig {
  maxSteps?: number;
  maxToolCalls?: number;
  developmentMode?: boolean;
}

export interface ProgressCallback {
  (message: string): void;
}

export class ToolOrchestrator {
  private apiKey: string;
  private openaiClient: ReturnType<typeof createOpenAI>;
  private openrouterClient?: ReturnType<typeof createOpenAI>;
  private progressCallback?: ProgressCallback;
  private vectorStoreIds: string[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Load config asynchronously in background
    this.loadVectorStoreConfig().catch(error => {
      console.warn('Failed to load vector store config:', error);
    });

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

  private async loadVectorStoreConfig() {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.resolve(process.cwd(), 'settings/vector-search.json');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      this.vectorStoreIds = config.vectorStoreIds || [];
    } catch (error) {
      console.warn('Could not load vector store config:', error);
      this.vectorStoreIds = [];
    }
  }

  setProgressCallback(callback: ProgressCallback) {
    this.progressCallback = callback;
  }

  private logProgress(message: string) {
    // Always log to console for debugging, regardless of streaming
    console.log(message);

    // Also send to UI via callback if streaming
    if (this.progressCallback) {
      this.progressCallback(message);
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
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    toolRegistry: ToolRegistry,
    model: ModelType = 'gpt-4.1-mini',
    config: OrchestratorConfig = {},
    fileIds: string[] = []
  ): Promise<OrchestrationResult> {
    const {
      maxSteps = 10,
      maxToolCalls = 5,
      developmentMode = false
    } = config;

    // Handle file context integration for supported models
    if (fileIds.length > 0) {
      console.log(`🗃️ Orchestrator received ${fileIds.length} file IDs for context:`, fileIds);

      // Check if the model supports file search
      const { supportsFileSearch } = await import('../appconfig/models');
      const modelSupportsFiles = supportsFileSearch(model);

      if (modelSupportsFiles) {
        console.log(`📄 Model ${model} supports file search - routing to file processing`);

        // For models that support file search, route to AI service file processing
        try {
          const { AIService } = await import('./ai-service');
          const aiService = new AIService(this.apiKey);

          const fileProcessingResult = await aiService.processMessageWithFiles(
            userMessage,
            fileIds,
            model
          );

          // Return the file processing result as the final answer
          return {
            success: true,
            finalAnswer: fileProcessingResult,
            steps: [{
              id: 'file_processing',
              type: 'synthesis',
              timestamp: Date.now(),
              content: fileProcessingResult,
              reasoning: 'Processed user message with uploaded files using OpenAI Assistant API'
            }],
            toolCalls: [],
            fileProcessingUsed: true
          };

        } catch (error) {
          console.error('File processing failed:', error);
          // Fall back to regular orchestration with a note about file processing failure
          this.logProgress(`⚠️ File processing failed: ${error instanceof Error ? error.message : 'Unknown error'} - continuing with regular orchestration`);
        }
      } else {
        console.log(`⚠️ Model ${model} does not support file search - files will be ignored`);
        this.logProgress(`⚠️ The selected model (${model}) does not support file search. Files will be ignored for this request.`);
      }
    }

    const steps: OrchestrationStep[] = [];
    const toolCalls: ToolExecution[] = [];
    let currentStepId = 1;

    try {
      this.logProgress(`🎯 Starting orchestration for query: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
      this.logProgress(`⚙️ Using model: ${model} | Max steps: ${maxSteps} | Max tool calls: ${maxToolCalls}`);

      // Build internal conversation context that accumulates as we progress
      const internalConversation: Array<{ role: 'user' | 'assistant'; content: string; }> = [
        { role: 'user', content: userMessage }
      ];

      // Step 1: Initial analysis
      this.logProgress(`🔍 Performing initial analysis...`);
      const analysisStep = await this.performAnalysis(userMessage, chatHistory, toolRegistry, model, currentStepId++);
      steps.push(analysisStep);

      // Add analysis to internal conversation
      internalConversation.push({ role: 'assistant', content: `Analysis: ${analysisStep.content}` });

      let needsMoreInformation = true;
      let currentContext = userMessage;
      let toolCallCount = 0;

      // Iterative tool calling and evaluation
      while (needsMoreInformation && steps.length < maxSteps && toolCallCount < maxToolCalls) {
        this.logProgress(`🤔 Iteration ${steps.length}: Deciding on tool usage (${toolCallCount}/${maxToolCalls} tools used)...`);

        // Step 2: Determine what tools to call
        const toolDecisionStep = await this.decideToolUsage(
          currentContext,
          toolRegistry,
          toolCalls,
          steps,
          model,
          currentStepId++,
          internalConversation // Pass internal conversation context
        );
        steps.push(toolDecisionStep);

        // Add tool decision to internal conversation
        internalConversation.push({ role: 'assistant', content: `Tool Planning: ${toolDecisionStep.content}` });

        // Parse tool decisions and execute tools
        const toolsToCall = this.parseToolDecisions(toolDecisionStep.content);

        if (toolsToCall.length === 0) {
          this.logProgress(`✋ No more tools needed - proceeding to synthesis`);
          needsMoreInformation = false;
          break;
        }

        this.logProgress(`🔧 Planning to execute ${toolsToCall.length} tools: ${toolsToCall.map(t => t.name).join(', ')}`);

        // Execute tools
        for (const toolCall of toolsToCall) {
          if (toolCallCount >= maxToolCalls) break;

          // Enforce original query for first vectorFileSearch call
          if (
            toolCall.name === 'vectorFileSearch' &&
            toolCallCount === 0 && // first tool call
            toolCall.parameters &&
            typeof toolCall.parameters.query === 'string' &&
            toolCall.parameters.query !== userMessage
          ) {
            toolCall.parameters.query = userMessage;
          }

          // Auto-inject vectorStoreIds for vectorFileSearch if not provided
          if (toolCall.name === 'vectorFileSearch' && toolCall.parameters && !toolCall.parameters.vectorStoreIds) {
            try {
              const fs = await import('fs');
              const path = await import('path');
              const configPath = path.resolve(process.cwd(), 'settings/vector-search.json');
              const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
              toolCall.parameters.vectorStoreIds = config.vectorStoreIds;
            } catch (error) {
              this.logProgress(`⚠️ Could not load vectorStoreIds from config: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }

          this.logProgress(`🔧 Executing tool: ${toolCall.name} with parameters: ${JSON.stringify(toolCall.parameters)}`);

          const startTime = Date.now();
          const result = await toolRegistry.executeTool(toolCall.name, toolCall.parameters);


          // Enhanced logging for all tools
          this.logProgress(`🛠️ Tool "${toolCall.name}" parameters: ${JSON.stringify(toolCall.parameters, null, 2)}`);
          this.logProgress(`📥 Tool "${toolCall.name}" result: ${JSON.stringify(result, null, 2)}`);

          // Enhanced consolidated logging for vectorFileSearch
          if (toolCall.name === 'vectorFileSearch') {
            const vectorStoreIds = toolCall.parameters && toolCall.parameters.vectorStoreIds ? JSON.stringify(toolCall.parameters.vectorStoreIds) : 'N/A';
            const returnedData = result && result.data ? JSON.stringify(result.data, null, 2) : 'No data returned';
            this.logProgress(
              `� [vectorFileSearch] Tool executed.\n` +
              `   - Queried vectorStoreIds: ${vectorStoreIds}\n` +
              `   - Parameters: ${JSON.stringify(toolCall.parameters, null, 2)}\n` +
              `   - Returned data: ${returnedData}`
            );
          }

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

          // Enhanced logging based on tool type and result
          if (toolCall.name === 'searchEvents' || toolCall.name === 'getEvents') {
            if (result.success) {
              const eventCount = Array.isArray(result.data) ? result.data.length : 0;
              this.logProgress(`📅 Calendar tool ${toolCall.name} succeeded: Found ${eventCount} events (${endTime - startTime}ms)`);
              if (eventCount > 0 && Array.isArray(result.data)) {
                const eventTitles = result.data.slice(0, 3).map((e: unknown) => {
                  if (typeof e === 'object' && e !== null) {
                    const event = e as { summary?: string; title?: string };
                    return event.summary || event.title || 'Untitled Event';
                  }
                  return 'Untitled Event';
                }).join(', ');
                this.logProgress(`📋 Event summary: ${eventTitles}${eventCount > 3 ? '...' : ''}`);
              }
            } else {
              this.logProgress(`❌ Calendar tool ${toolCall.name} failed: ${result.error || result.message || 'Unknown error'} (${endTime - startTime}ms)`);
            }
          } else if (toolCall.name === 'createEvent') {
            if (result.success) {
              const eventTitle = typeof result.data === 'object' && result.data !== null && 'summary' in result.data
                ? (result.data as { summary: string }).summary
                : 'New event';
              this.logProgress(`✅ Event created successfully: ${eventTitle} (${endTime - startTime}ms)`);
            } else {
              this.logProgress(`❌ Event creation failed: ${result.error || result.message || 'Unknown error'} (${endTime - startTime}ms)`);
            }
          } else {
            // General tool logging
            if (result.success) {
              this.logProgress(`✅ Tool ${toolCall.name} completed successfully (${endTime - startTime}ms)`);
            } else {
              this.logProgress(`❌ Tool ${toolCall.name} failed: ${result.error || result.message || 'Unknown error'} (${endTime - startTime}ms)`);
            }
          }

          // Add tool execution step
          steps.push({
            id: `step_${currentStepId++}`,
            type: 'tool_call',
            timestamp: Date.now(),
            content: `Executed tool: ${toolCall.name}`,
            toolExecution: execution,
            reasoning: `Called ${toolCall.name} with parameters: ${JSON.stringify(toolCall.parameters)}`
          });

          // Add tool result to internal conversation
          const resultSummary = execution.result.success
            ? `Tool ${toolCall.name} succeeded: ${JSON.stringify(execution.result.data)}`
            : `Tool ${toolCall.name} failed: ${execution.result.error || 'Unknown error'}`;
          internalConversation.push({ role: 'assistant', content: resultSummary });
        }

        // Step 3: Evaluate if we have enough information
        this.logProgress(`📝 Evaluating progress and determining if more information is needed...`);
        const evaluationStep = await this.evaluateProgress(
          userMessage,
          currentContext,
          toolCalls,
          steps,
          model,
          currentStepId++,
          internalConversation // Pass internal conversation context
        );
        steps.push(evaluationStep);

        // Add evaluation to internal conversation
        internalConversation.push({ role: 'assistant', content: `Evaluation: ${evaluationStep.content}` });

        // Update context with tool results
        currentContext = this.buildUpdatedContext(userMessage, toolCalls);

        // Check if evaluation indicates we have enough information
        needsMoreInformation = this.needsMoreInformation(evaluationStep.content);
        this.logProgress(`📊 Evaluation result: ${needsMoreInformation ? 'Need more information' : 'Sufficient information gathered'}`);

        // Special validation for calendar queries - ensure tools were actually called
        if (!needsMoreInformation && this.isCalendarQuery(userMessage)) {
          const hasSuccessfulCalendarTools = toolCalls.some(call =>
            (call.tool === 'searchEvents' || call.tool === 'getEvents') && call.result.success
          );

          const hasAttemptedCalendarTools = toolCalls.some(call =>
            call.tool === 'searchEvents' || call.tool === 'getEvents'
          );

          const calendarToolCalls = toolCalls.filter(call =>
            call.tool === 'searchEvents' || call.tool === 'getEvents'
          );

          // Force continuation if no calendar tools were attempted at all, but only if we haven't hit limits
          if (!hasAttemptedCalendarTools && toolCallCount < maxToolCalls && steps.length < maxSteps) {
            needsMoreInformation = true;
            this.logProgress(`🔄 Forcing tool retry for calendar query - no calendar tools attempted yet (${toolCallCount}/${maxToolCalls} tool calls used)`);
          } else if (!hasSuccessfulCalendarTools && hasAttemptedCalendarTools) {
            // Tools were attempted but failed - this is acceptable if handled gracefully
            const failedAttempts = calendarToolCalls.filter(call => !call.result.success).length;
            this.logProgress(`⚠️ Calendar tools attempted but failed - proceeding with error explanation (${failedAttempts} failed attempts)`);

            // Log details of failed attempts
            calendarToolCalls.forEach(call => {
              if (!call.result.success) {
                this.logProgress(`   └─ ${call.tool}: ${call.result.error || call.result.message || 'Unknown error'}`);
              }
            });
          } else if (!hasAttemptedCalendarTools) {
            // We've hit limits without attempting calendar tools
            this.logProgress(`⚠️ Calendar query completed without attempting calendar tools due to limits reached (${toolCallCount}/${maxToolCalls} tool calls, ${steps.length}/${maxSteps} steps)`);
          } else {
            // Success case - we have successful calendar tools
            const successfulAttempts = calendarToolCalls.filter(call => call.result.success).length;
            this.logProgress(`✅ Calendar tools executed successfully (${successfulAttempts} successful attempts)`);
          }
        }
      }

      // Iterative synthesis with format validation
      this.logProgress(`🧠 Synthesizing response from ${toolCalls.length} tool executions...`);

      // Log summary of tool results for synthesis
      const successfulTools = toolCalls.filter(call => call.result.success).length;
      const failedTools = toolCalls.filter(call => !call.result.success).length;
      this.logProgress(`📊 Tool execution summary: ${successfulTools} successful, ${failedTools} failed`);

      let synthesisStep = await this.synthesizeFinalAnswer(
        userMessage,
        chatHistory,
        currentContext,
        toolCalls,
        steps,
        model,
        currentStepId++,
        internalConversation // Pass the full internal conversation context
      );
      steps.push(synthesisStep);

      // Check if synthesis matches user intent and iterate if needed
      const maxSynthesisIterations = 3;
      let synthesisIterations = 1;

      while (synthesisIterations < maxSynthesisIterations) {
        this.logProgress(`🔍 Validating response format (iteration ${synthesisIterations}/${maxSynthesisIterations})...`);

        const formatValidation = await this.validateResponseFormat(
          userMessage,
          synthesisStep.content,
          model,
          currentStepId++
        );
        steps.push(formatValidation);

        if (this.isFormatAcceptable(formatValidation.content)) {
          this.logProgress(`✅ Response format validated successfully`);
          break;
        }

        this.logProgress(`🔄 Refining response based on validation feedback...`);
        // Refine synthesis based on validation feedback
        synthesisStep = await this.refineSynthesis(
          userMessage,
          chatHistory,
          currentContext,
          toolCalls,
          steps,
          synthesisStep.content,
          formatValidation.content,
          model,
          currentStepId++
        );
        steps.push(synthesisStep);
        synthesisIterations++;
      }

      if (synthesisIterations >= maxSynthesisIterations) {
        this.logProgress(`⚠️ Response format validation reached maximum iterations (${maxSynthesisIterations})`);
      }

      const totalDuration = Date.now() - (steps[0]?.timestamp || Date.now());
      this.logProgress(`🎉 Orchestration completed successfully in ${totalDuration}ms (${steps.length} steps, ${toolCalls.length} tool calls)`);

      return {
        success: true,
        finalAnswer: synthesisStep.content,
        steps: developmentMode ? steps : steps.filter(step => step.type === 'synthesis'),
        toolCalls
      };

    } catch (error) {
      this.logProgress(`💥 Orchestration failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    toolRegistry: ToolRegistry,
    model: ModelType,
    stepId: number
  ): Promise<OrchestrationStep> {
    const availableCategories = toolRegistry.getAvailableCategories();
    const categorizedToolsList = availableCategories
      .map(category => {
        const tools = toolRegistry.getToolsByCategory(category);
        return `**${category.toUpperCase()}**:\n${tools.map(tool => {
          // Provide parameter information based on tool name
          let paramInfo = 'See tool schema';
          if (tool.name === 'vectorFileSearch') {
            paramInfo = 'query (required), maxResults (optional)';
          } else if (tool.name === 'searchEvents') {
            paramInfo = 'searchTerm (required), startDate, endDate, maxResults';
          }
          return `  - ${tool.name}: ${tool.description} (Parameters: ${paramInfo})`;
        }).join('\n')}`;
      }).join('\n\n');

    const prompt = `
Today is ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}.

You are a **CALENDAR ASSISTANT** with intelligent tool orchestration capabilities. Your primary purpose is to help users manage their calendar, events, and schedule-related information, with the help of various tools (e.g., searchEvents for calendar integration and vectorFileSearch for knowledge base queries).
Your goal is to analyze the user's request and determine the best next steps to answer their query based on available tools and context below.
---START OF CONTEXT---
${this.formatChatHistory(chatHistory)}
---END OF CONTEXT---

User Request: "${userMessage}"

Available Tools by Category:
${categorizedToolsList}

**ALWAYS REMEMBER**:
- ONLY answer using the tools provided in the tool registry and the context provided. NEVER attempt to answer questions using internal knowledge or guesswork. If you cannot find an answer using the tools, clearly state that no information was found.
- Use calendar tools for calendar-related queries, such as searching for events, creating events, or managing schedules.
- Use vectorFileSearch for knowledge base queries, such as searching for documentation, policies, or general knowledge.
- Do not use web search tools for knowledge queries; always prefer vectorFileSearch.
- If the user's question is too generic or vague, ask for more details before using any tools.

**CRITICAL CONTEXT**: This is a calendar management application.
Any mention of:
- Projects (like "progetto Italmagneti", "Nespola project", "TechCorp", etc.)
- Companies or client names
- Work activities, meetings, or project status
- Deadlines for visa or projects or time-sensitive information
- Documents expiring or needing updates
- "What can you tell me about..." relating to business/work topics
- Summary requests about work/project topics
- Questions about project progress, timeline, or history

Should **ALWAYS** be interpreted as **CALENDAR QUERIES** that require searching calendar data, NOT as translation or general knowledge requests.

Any questions that:
- cannot be answered from calendar data (e.g., asks for documentation, policies, procedures, general knowledge, visa information, travel requirements, or other uploaded information)
- requires domain-specific knowledge (e.g., company policies, visa requirements, travel guidelines, document requirements, deadlines and other general knowledge)
- asks for documentation, policies, procedures, or general knowledge
- asks for information about benefits, travel requirements, or visa types

MUST be answered using the vectorFileSearch tool to search the knowledge base, NOT calendar tools.


**MANDATORY EXAMPLES FOR CALENDAR QUERIES**:
- "what was the core reason for the project I've been working for in microsoft in 2025" → Use calendar tools to Search for all events containing "microsoft" in 2025
- "tell me about the microsoft project" → Use calendar tools to search for all events containing "microsoft"
- "how is the project going?" → Use calendar tools to search for recent project-related events, limited to the last 20 records/events
- "project status" → Use calendar tools to search for project meetings and updates
- "project status for last quarter" → Use calendar tools to search for project meetings and updates in the last quarter


**MANDATORY EXAMPLES FOR NON-CALENDAR KNOWLEDGE QUERIES**:
- "What is the company policy on remote work?" → Use vectorFileSearch
- "Show me the documentation about visa requirements" → Use vectorFileSearch
- "What are the travel guidelines?" → Use vectorFileSearch
- "I need information about benefits" → Use vectorFileSearch
- "I am italian, what type of visa to indonesia can I get?" → Use vectorFileSearch
- "What documents do I need for travel?" → Use vectorFileSearch
- "I need to know the visa requirements for a business trip to Bali" → Use vectorFileSearch
- "My passport expires next month, can I still apply for a visa? What should I do?" → Use vectorFileSearch

**CRITICAL RULES FOR KNOWLEDGE QUERIES**:
1. ALWAYS use vectorFileSearch for visa, travel, policy, documentation, or general knowledge questions
2. Do NOT use web search tools for knowledge queries
3. Do NOT attempt to answer knowledge questions from internal AI knowledge or guess
4. ONLY return what is found in the vector store via vectorFileSearch
5. If vectorFileSearch returns no results, clearly state that no information was found in the knowledge base

**IMPORTANT**:
- You must always prioritize calendar tools for project/work queries, and use vectorFileSearch for knowledge/documentation queries. though the two tools can be combined, in the correct sequence, to produce the best results and answer the user's question or perform the requested action/s.
- If the user's question is too generic or vague, you should first answer by asking for more information about what you need to know, or what you need to do, before using any tools.


**EXAMPLE OF COMBINED TOOL USAGE**:
- User asks something like "Set an appointment for next week do discuss about my visa requirements for my trip to Bali" -> The sequence of actions would be:
  1. Ask for more details about the reason for the visit (e.g., "What is the purpose of your trip to Bali? Is it for business or tourism?") and appointment timing (e.g., " and What day and time next week works for you?")
  2. Use vectorSearch to find information about visa requirements (eg. passport validity, processing times and required documents to apply) for user's specific purpose, nationality and situation (note: you can rephrase user's question and to maximize search effectiveness)
  3. Then use calendar tools to find any free slot of 30 minutes next week or when the user is available.
  4. If there are more than one free slot, ask the user to choose one of them.
  5. Create the event in the calendar with the information found in the vector search (a summary of it) and the original user's request.


Now perform a comprehensive analysis:

## 1. REQUEST DECOMPOSITION
Break down the user's request into:
- Primary objective(s)
- Required information or actions
- Potential sub-tasks or dependencies

## 2. TOOL STRATEGY
For each objective, identify:
- Which tool categories are most relevant
- Specific tools that might be needed (e.g., searchEvents, vectorFileSearch, or none)
- Optimal sequence of tool calls (e.g., if a calendar search is needed before a file search, or vice versa)
- Dependencies between tools (e.g., if one tool's output is required as input for another)

## 3. INFORMATION REQUIREMENTS
Determine what information you need to gather:
- Direct answers to user questions (when no tools are needed anymore and sufficient information is available)
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
      content: response?.text || 'No response text available',
      reasoning: 'Comprehensive analysis of user request and strategic tool planning'
    };
  }

  private async decideToolUsage(
    context: string,
    toolRegistry: ToolRegistry,
    previousToolCalls: ToolExecution[],
    previousSteps: OrchestrationStep[],
    model: ModelType,
    stepId: number,
    internalConversation?: Array<{ role: 'user' | 'assistant'; content: string; }>
  ): Promise<OrchestrationStep> {
    const availableCategories = toolRegistry.getAvailableCategories();
    const categorizedToolsList = availableCategories
      .map(category => {
        const tools = toolRegistry.getToolsByCategory(category);
        return `**${category.toUpperCase()}**:\n${tools.map(tool => {
          // Provide parameter information based on tool name
          let paramInfo = 'See tool schema';
          if (tool.name === 'vectorFileSearch') {
            const vectorStoreIdsStr = this.vectorStoreIds.length > 0
              ? JSON.stringify(this.vectorStoreIds)
              : '["vs_id1", "vs_id2"]';
            paramInfo = `{ query: "search term", vectorStoreIds?: ${vectorStoreIdsStr}, maxResults?: number }`;
          } else if (tool.name === 'searchEvents') {
            paramInfo = '{ query: "term", timeRange?: { start: "YYYY-MM-DDTHH:MM:SSZ", end: "YYYY-MM-DDTHH:MM:SSZ" } }';
          } else if (tool.name === 'getEvents') {
            paramInfo = '{ timeRange?: { start: "YYYY-MM-DDTHH:MM:SSZ", end: "YYYY-MM-DDTHH:MM:SSZ" }, filters?: { maxResults: number } }';
          }
          return `  - ${tool.name}: ${tool.description}\n    Parameters: ${paramInfo}`;
        }).join('\n')}`;
      }).join('\n\n');

    const previousCallsContext = previousToolCalls.length > 0
      ? `\nPrevious tool calls and results:\n${previousToolCalls.map(call => {
          const result = typeof call.result.data === 'object'
            ? JSON.stringify(call.result.data, null, 2).substring(0, 500) + '...'
            : call.result.data;
          return `${call.tool}(${JSON.stringify(call.parameters)}): ${call.result.success ? 'SUCCESS' : 'FAILED'}\n  Result: ${result}\n  Message: ${call.result.message || 'N/A'}`;
        }).join('\n\n')}`
      : '';

    const previousStepsContext = previousSteps.length > 0
      ? `\nPrevious processing steps:\n${previousSteps.map(step => {
          const content = step.content.length > 300 ? step.content.substring(0, 300) + '...' : step.content;
          return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
        }).join('\n\n')}`
      : '';

    const prompt = `
Today is ${new Date().toISOString().split('T')[0]}.

You are an **intelligent CALENDAR ASSISTANT** with live access to tools.
Your goal is to decide the *next* action that moves us closer to answering the user.

---

## USER CONTEXT
${context}${previousCallsContext}${previousStepsContext}
${internalConversation && internalConversation.length > 1 ? this.formatInternalConversation(internalConversation) : ''}

## AVAILABLE TOOLS
${categorizedToolsList}

---

### DECISION RULES

1. **FOR EVENT CREATION/MODIFICATION**: **ALWAYS** use appropriate calendar tools
   - "add", "create", "schedule", "book", "set up", "make", "plan" → Use createEvent tool
   - "update", "change", "modify", "edit", "reschedule", "move" → Use updateEvent tool
   - "delete", "remove", "cancel", "clear" → Use deleteEvent tool
   - **CRITICAL**: For createEvent, always include required fields: summary, start, end times
   - Use proper date/time formats: "2025-09-21T09:00:00" for timed events, "2025-09-21" for all-day

2. **FOR PROJECT/WORK QUERIES**: **ALWAYS** search calendar first using searchEvents or getEvents
   - Extract project/company names from the query
   - Search calendar data before responding with "I don't know"
   - Use broad search terms (e.g., "italmagneti", "nespola", "techcorp")

3. **FOR KNOWLEDGE/DOCUMENTATION QUERIES**: **ALWAYS** use vectorFileSearch for non-calendar information
   - **IMPORTANT:** For the first tool call, ALWAYS use the user's original query as the 'query' parameter for vectorFileSearch, without rephrasing or summarizing.
   - Only if the first attempt returns no results, try rephrasing or adding extra details for subsequent attempts.
   - **CRITICAL:** When calling vectorFileSearch, ALWAYS include the vectorStoreIds parameter with the actual vector store IDs shown in the tool parameters above. Do NOT omit this parameter.
   - Use vectorFileSearch for visa, travel, policy, documentation, or general knowledge questions
   - Examples: visa requirements, company policies, travel guidelines, benefits information
   - Do NOT use web search tools - vectorFileSearch is the primary knowledge tool

4. **Need more info?** – Plan the *minimal* set of tool calls that will get it.
5. **Enough info?** – Say so and explain briefly.

**PRIORITY ORDER**:
- Event creation/modification → createEvent, updateEvent, deleteEvent
- Calendar queries → searchEvents, getEvents
- Knowledge queries → vectorFileSearch
- File operations → file tools
- Email operations → email tools

**MANDATORY EXAMPLES FOR EVENT CREATION**:
- "add event on Sep 21, 2025. title: cancel chatgpt subscription" → Use createEvent with summary="Cancel ChatGPT subscription", start/end dates for Sep 21, 2025
- "schedule a meeting tomorrow at 2pm" → Use createEvent with appropriate date/time
- "create appointment next week" → Use createEvent (may need to ask for specific date/time)
- "book time for project review" → Use createEvent
- "plan a call with the team" → Use createEvent

**MANDATORY EXAMPLES FOR CALENDAR SEARCHES**:
- "show me my events" → Use getEvents with no parameters to get recent events
- "summarize last week calendar activities" → Use getEvents with timeRange: {start: "2025-06-16T00:00:00Z", end: "2025-06-22T23:59:59Z"}
- "events for this month" → Use getEvents with timeRange for current month
- "meetings in March 2025" → Use getEvents with timeRange: {start: "2025-03-01T00:00:00Z", end: "2025-03-31T23:59:59Z"}
- "find events with nespola" → Use searchEvents with query: "nespola"
- "nespola activities from march to june" → Use searchEvents with query: "nespola", timeRange: {start: "2025-03-01T00:00:00Z", end: "2025-06-30T23:59:59Z"}
- "italmagneti project status" → Use searchEvents with query: "italmagneti"

**CRITICAL DATE PARSING RULES:**
- "last week" = June 16-22, 2025 (current date: June 23, 2025)
- "this week" = June 16-22, 2025
- "next week" = June 23-29, 2025
- "this month" = June 1-30, 2025
- "last month" = May 1-31, 2025
- Always use UTC format: "YYYY-MM-DDTHH:MM:SSZ"
- For date ranges, use 00:00:00Z for start and 23:59:59Z for end

### RESPONSE FORMATS

If tools are required **respond exactly like**:

\`\`\`json
CALL_TOOLS:
[
  {
    "name": "<tool_name>",
    "parameters": { /* parameters */ },
    "reasoning": "<why this tool and params are right>"
  }
]
\`\`\`

If no tools are needed **respond exactly like**:

\`\`\`
SUFFICIENT_INFO: <one‑sentence reason>
\`\`\`

*No other text or formatting.*
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
      content: response?.text || 'No response text available',
      reasoning: 'Strategic tool selection and parameter planning'
    };
  }

  private async evaluateProgress(
    originalMessage: string,
    currentContext: string,
    toolCalls: ToolExecution[],
    previousSteps: OrchestrationStep[],
    model: ModelType,
    stepId: number,
    internalConversation?: Array<{ role: 'user' | 'assistant'; content: string; }>
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

    const previousStepsContext = previousSteps.length > 0
      ? `\n**Previous Processing Steps:**\n${previousSteps.map(step => {
          const content = step.content.length > 200 ? step.content.substring(0, 200) + '...' : step.content;
          return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
        }).join('\n')}`
      : '';

    const prompt = `
## PROGRESS EVALUATION TASK

**Original User Request:** "${originalMessage}"

## INTERNAL PROCESS CONTEXT
${internalConversation && internalConversation.length > 1 ? this.formatInternalConversation(internalConversation) : ''}

${previousStepsContext}

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
      content: response?.text || 'No response text available',
      reasoning: 'Comprehensive evaluation of information completeness and next steps'
    };
  }

  private async synthesizeFinalAnswer(
    userMessage: string,
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    context: string,
    toolCalls: ToolExecution[],
    previousSteps: OrchestrationStep[],
    model: ModelType,
    stepId: number,
    internalConversation?: Array<{ role: 'user' | 'assistant'; content: string; }>
  ): Promise<OrchestrationStep> {
    // Check if this is an action request (create, update, delete) that requires tool execution
    const isActionRequest = /\b(add|create|schedule|book|set up|make|plan|update|change|modify|edit|reschedule|move|delete|remove|cancel|clear)\b/i.test(userMessage);
    const hasActionTools = toolCalls.some(call => ['createEvent', 'updateEvent', 'deleteEvent'].includes(call.tool));

    if (isActionRequest && !hasActionTools) {
      this.logProgress(`⚠️ Action request detected but no action tools were called - preventing fabricated success claims`);
    }

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

    const previousStepsContext = previousSteps.length > 0
      ? `\n**Processing Steps Summary:**\n${previousSteps.map(step => {
          const content = step.content.length > 150 ? step.content.substring(0, 150) + '...' : step.content;
          return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
        }).join('\n')}\n`
      : '';

    const prompt = `
## RESPONSE SYNTHESIS TASK

${this.formatChatHistory(chatHistory)}

${internalConversation && internalConversation.length > 1 ? this.formatInternalConversation(internalConversation) : ''}

**User's Original Request:** "${userMessage}"
**Action Request Detected:** ${isActionRequest ? 'YES' : 'NO'}
**Action Tools Called:** ${hasActionTools ? 'YES' : 'NO'}
**Tool Calls Made:** ${toolCalls.length}
${previousStepsContext}
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
- **CALENDAR CONTEXT**: This is a calendar assistant - queries about projects, companies, work should be answered using calendar data only
- **NO TRANSLATION RESPONSES**: Do not provide translation services - this is a calendar assistant, not a translator
- **RETRY REQUIREMENT**: If initial tool calls fail or return insufficient data, try alternative parameters or different tools
- **NO FABRICATION**: Only use information that was actually retrieved from tool executions
- **DATA VALIDATION**: If no relevant data is found, explicitly state this rather than making assumptions
- **Accuracy**: Only include information that was actually retrieved/confirmed from tool calls
- **Completeness**: Address all aspects of the user's request using only retrieved data
- **Clarity**: Use clear language and avoid technical jargon
- **Helpfulness**: Provide context and actionable information based on real data
- **Formatting**: Use proper markdown syntax for headings, lists, bold text, etc.

## CRITICAL RULE FOR CALENDAR ASSISTANT
**NEVER CLAIM ACTIONS WERE COMPLETED UNLESS TOOLS WERE ACTUALLY CALLED AND SUCCEEDED**

If the user requested an action (create, update, delete events) but no tools were called:
- NEVER say "Event has been added/updated/deleted"
- NEVER claim success for actions that weren't performed
- Instead explain that the action could not be completed and ask for clarification

If tools were not called or returned no relevant data, you MUST state that no information was found rather than generating any content. NEVER make up or fabricate information. NEVER provide translation services - this is a calendar application.

**Examples of FORBIDDEN responses when no tools were called:**
- ❌ "The event has been added to your calendar"
- ❌ "I've created the event for you"
- ❌ "Event deleted successfully"

**Examples of CORRECT responses when no tools were called:**
- ✅ "I was unable to create the event. Could you please provide more specific details about the date and time?"
- ✅ "I need more information to create this event. What specific time on September 21st would you like?"
- ✅ "I couldn't process this request. Please check the event details and try again."

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
      content: response?.text || 'No response text available',
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
      content: response?.text || 'No response text available',
      reasoning: 'Validation of response format alignment with user intent'
    };
  }

  private async refineSynthesis(
    userMessage: string,
    chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>,
    context: string,
    toolCalls: ToolExecution[],
    previousSteps: OrchestrationStep[],
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

    const previousStepsContext = previousSteps.length > 0
      ? `\n**Processing Steps Summary:**\n${previousSteps.map(step => {
          const content = step.content.length > 150 ? step.content.substring(0, 150) + '...' : step.content;
          return `[${step.id}] ${step.type.toUpperCase()}: ${content}`;
        }).join('\n')}\n`
      : '';

    const prompt = `
## RESPONSE REFINEMENT TASK

${this.formatChatHistory(chatHistory)}

**User's Original Request:** "${userMessage}"
${previousStepsContext}
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
      content: response?.text || 'No response text available',
      reasoning: 'Refined synthesis based on format validation feedback'
    };
  }

  private parseToolDecisions(content: string): Array<{ name: string; parameters: Record<string, unknown> }> {
    this.logProgress(`🔍 Parsing tool decisions from content: ${content.substring(0, 500)}...`);

    try {
      // Look for CALL_TOOLS: section with JSON
      const callToolsMatch = content.match(/```json[\s\S]*?CALL_TOOLS:\s*(\[[\s\S]*?\])\s*```/);
      if (callToolsMatch) {
        this.logProgress(`📋 Found CALL_TOOLS in json block: ${callToolsMatch[1]}`);
        const toolsJson = callToolsMatch[1];
        const tools = JSON.parse(toolsJson);
        if (Array.isArray(tools)) {
          const parsedTools = tools.map(tool => ({
            name: tool.name,
            parameters: tool.parameters
          }));
          this.logProgress(`✅ Successfully parsed ${parsedTools.length} tools from json block`);
          return parsedTools;
        }
      }

      // Fallback: Look for CALL_TOOLS: without code blocks
      const fallbackMatch = content.match(/CALL_TOOLS:\s*(\[[\s\S]*?\])/);
      if (fallbackMatch) {
        this.logProgress(`📋 Found CALL_TOOLS without block: ${fallbackMatch[1]}`);
        const toolsJson = fallbackMatch[1];
        const tools = JSON.parse(toolsJson);
        if (Array.isArray(tools)) {
          const parsedTools = tools.map(tool => ({
            name: tool.name,
            parameters: tool.parameters
          }));
          this.logProgress(`✅ Successfully parsed ${parsedTools.length} tools from fallback`);
          return parsedTools;
        }
      }

      // Check for SUFFICIENT_INFO pattern
      if (content.includes('SUFFICIENT_INFO:')) {
        this.logProgress(`ℹ️ Found SUFFICIENT_INFO - no tools needed`);
        return [];
      }

      // Look for EXECUTE: format with PARAMETERS:
      const executeMatch = content.match(/EXECUTE:\s*(\w+)[\s\S]*?PARAMETERS:\s*(\{[\s\S]*?\})/);
      if (executeMatch) {
        this.logProgress(`📋 Found EXECUTE format: ${executeMatch[1]}`);
        const toolName = executeMatch[1];
        const parametersJson = executeMatch[2];
        try {
          const parameters = JSON.parse(parametersJson);
          this.logProgress(`✅ Successfully parsed EXECUTE tool`);
          return [{
            name: toolName,
            parameters: parameters
          }];
        } catch (parseError) {
          this.logProgress(`❌ Error parsing EXECUTE parameters: ${parseError}`);
        }
      }

      // Additional fallback: Look for tools in any JSON array format
      const jsonArrayMatch = content.match(/(\[[\s\S]*?\])/);
      if (jsonArrayMatch) {
        try {
          const tools = JSON.parse(jsonArrayMatch[1]);
          if (Array.isArray(tools) && tools.length > 0 && tools[0].name) {
            const parsedTools = tools.map(tool => ({
              name: tool.name,
              parameters: tool.parameters
            }));
            this.logProgress(`✅ Successfully parsed ${parsedTools.length} tools from JSON array fallback`);
            return parsedTools;
          }
        } catch {
          // Ignore parsing errors for non-tool JSON
        }
      }

      this.logProgress(`⚠️ No valid tool calls found in content`);
    } catch (error) {
      this.logProgress(`❌ Error parsing tool decisions: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      // Reading/searching calendar
      'events', 'meetings', 'calendar', 'schedule', 'appointment',
      'show me', 'list', 'find', 'search', 'when', 'what meetings',
      'holistic vision', 'summary', 'overview',
      // Creating/modifying calendar events
      'add', 'create', 'schedule', 'book', 'set up', 'make', 'plan',
      'update', 'change', 'modify', 'edit', 'reschedule', 'move',
      'delete', 'remove', 'cancel', 'clear',
      // Project/work references (calendar context)
      'italmagneti', 'nespola', 'project', 'work', 'daily report',
      'meeting', 'call', 'appointment', 'reminder'
    ];

    const messageLower = userMessage.toLowerCase();
    return calendarKeywords.some(keyword => messageLower.includes(keyword));
  }

  private formatChatHistory(chatHistory: Array<{ id: string; type: 'user' | 'assistant'; content: string; timestamp: number; }>): string {
    if (!chatHistory || chatHistory.length === 0) {
      return "This is the start of the conversation.";
    }

    const formatted = chatHistory.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleString();
      const role = msg.type === 'user' ? 'User' : 'Assistant';
      return `[${timestamp}] ${role}: ${msg.content}`;
    }).join('\n');

    return `Previous conversation history:\n${formatted}\n\nCurrent request:`;
  }

  private formatInternalConversation(internalConversation: Array<{ role: 'user' | 'assistant'; content: string; }>): string {
    if (!internalConversation || internalConversation.length <= 1) {
      return "";
    }

    const formatted = internalConversation.slice(1).map((msg, index) => {
      const step = index + 1;
      return `Step ${step}: ${msg.content}`;
    }).join('\n');

    return `\n**Internal Analysis and Processing:**\n${formatted}\n`;
  }
}
