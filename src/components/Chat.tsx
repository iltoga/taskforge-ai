'use client';

import { useCalendar } from '@/contexts/CalendarContext';
import { CalendarEvent } from '@/types/calendar';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ModelType } from '../appconfig/models';
import { useDevelopment } from '../contexts/DevelopmentContext';
import { ModelSelector } from './ModelSelector';
import { OrchestratorModelSelector } from './OrchestratorModelSelector';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: CalendarEvent | CalendarEvent[];
  toolCalls?: Array<{ tool: string; result: unknown }>;
  steps?: Array<{ id: string; type: string; content: string; reasoning?: string }>;
  progressMessages?: string[];
  approach?: 'legacy' | 'tools' | 'agentic';
}

// Utility function to safely stringify unknown values
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function Chat() {
  const { data: session, status } = useSession();
  const { addAPILog, isDevelopmentMode } = useDevelopment();
  const { selectedCalendarId, isInitialized } = useCalendar();


  // Initialize messages from sessionStorage to survive session refreshes
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('chat-messages');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Convert timestamp strings back to Date objects
          return parsed.map((msg: ChatMessage) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  // Debug: Log whenever component renders and message count
  console.log('🔄 Chat component render - Message count:', messages.length, 'Status:', status);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [currentSteps, setCurrentSteps] = useState<Array<{ id: string; type: string; content: string; reasoning?: string }>>([]);
  const [currentProgressMessages, setCurrentProgressMessages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gpt-4.1-mini-2025-04-14');
  const [orchestratorModel, setOrchestratorModel] = useState<ModelType>('gpt-4.1-mini-2025-04-14');
  const [useToolsMode, setUseToolsMode] = useState(true); // Default to ON for calendar access
  const [useAgenticMode, setUseAgenticMode] = useState(true); // Default to ON for best performance

  // Function to clear chat messages and sessionStorage
  const clearChat = () => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('chat-messages');
      } catch (error) {
        console.warn('Failed to clear messages from sessionStorage:', error);
      }
    }
  };

  // Function to handle final result processing (shared between streaming and regular fetch)
  const handleFinalResult = (result: { success: boolean; message?: string; error?: string; [key: string]: unknown }, duration: number) => {
    console.log('🎯🔥 handleFinalResult called with:', {
      success: result.success,
      messageLength: result.message?.length || 0,
      hasMessage: !!result.message,
      error: result.error,
      actualMessage: result.message?.substring(0, 200)
    });

    // CRITICAL: Clear loading state immediately
    setIsLoading(false);
    setLoadingStatus('');

    // Log the response
    addAPILog({
      service: 'ai',
      method: 'POST',
      endpoint: '/api/chat',
      response: result, // Log the full response instead of truncating
      duration,
    });

    // Handle different response scenarios
    let assistantContent = '';
    let receivedSteps: Array<{ id: string; type: string; content: string; reasoning?: string }> = [];

    if (result.success) {
      assistantContent = result.message || '';

      // If we have steps (agentic mode), show them progressively (only in dev mode)
      if (result.steps && Array.isArray(result.steps)) {
        receivedSteps = result.steps;

        // Animate steps appearance
        receivedSteps.forEach((step, index) => {
          setTimeout(() => {
            setCurrentSteps(prev => [...prev, step]);
          }, index * 800); // Show each step with 800ms delay
        });

        // Clear steps after showing the final response
        setTimeout(() => {
          setCurrentSteps([]);
        }, receivedSteps.length * 800 + 2000);
      }
    } else {
      // Show detailed error message from API
      assistantContent = result.error || 'An unknown error occurred';

      // Add helpful context and actions for specific errors
      if (result.status === 401) {
        if (assistantContent.includes('Google Calendar authentication')) {
          assistantContent += '\n\n🔄 To fix this: Sign out and sign in again to refresh your Google Calendar permissions.';
        } else {
          assistantContent += ' (Authentication required)';
        }
      } else if (result.status === 403) {
        assistantContent += '\n\n🔧 To fix this: Please ensure you granted calendar access during sign-in.';
      } else if (result.status === 429) {
        assistantContent += ' (Rate limit exceeded)';
      } else if (result.status === 500) {
        assistantContent += ' (Server error)';
      }
    }

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
      data: result.data as CalendarEvent | CalendarEvent[] | undefined,
      toolCalls: result.toolCalls as Array<{ tool: string; result: unknown }> | undefined,
      steps: result.steps as Array<{ id: string; type: string; content: string; reasoning?: string }> | undefined,
      progressMessages: result.progressMessages as string[] | undefined,
      approach: result.approach as 'legacy' | 'tools' | 'agentic' | undefined,
    };

    console.log('💬🔥 Adding assistant message to chat:', {
      messageId: assistantMessage.id,
      contentLength: assistantContent.length,
      content: assistantContent.substring(0, 200) + (assistantContent.length > 200 ? '...' : ''),
      messagesArrayLength: messages.length
    });

    setMessages(prev => {
      const newMessages = [...prev, assistantMessage];
      console.log('📝 Messages updated. Total count:', newMessages.length, 'Last message:', {
        id: assistantMessage.id,
        type: assistantMessage.type,
        preview: assistantMessage.content.substring(0, 50) + '...'
      });

      // Persist to sessionStorage to survive session refreshes
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('chat-messages', JSON.stringify(newMessages));
        } catch (error) {
          console.warn('Failed to save messages to sessionStorage:', error);
        }
      }

      return newMessages;
    });

    // Don't clear progress messages immediately - let the streaming logic handle it
    // or let user see them until next interaction
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading || !isInitialized) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => {
      const newUserMessage = [...prev, userMessage];
      console.log('👤 User message added. Total count:', newUserMessage.length);

      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('chat-messages', JSON.stringify(newUserMessage));
        } catch (error) {
          console.warn('Failed to save messages to sessionStorage:', error);
        }
      }

      return newUserMessage;
    });
    setInput('');
    setIsLoading(true);
    setCurrentSteps([]);
    setCurrentProgressMessages([]);

    // Simple initial status - real progress will come from orchestrator
    if (useAgenticMode && useToolsMode) {
      setLoadingStatus('🤖 Starting agentic orchestrator...');
    } else if (useToolsMode) {
      setLoadingStatus('🔧 Processing with calendar tools...');
    } else {
      setLoadingStatus('💬 Processing your message...');
    }

    const startTime = Date.now();

    try {
      // Log the client-side API call
      addAPILog({
        service: 'ai',
        method: 'POST',
        endpoint: '/api/chat',
        payload: {
          message: userMessage.content,
          model: selectedModel,
          useTools: useToolsMode,
          orchestratorModel: orchestratorModel,
          developmentMode: useAgenticMode,
          calendarId: selectedCalendarId,
        },
      });

      // Use streaming for agentic mode, regular fetch for others
      if (useAgenticMode && useToolsMode) {
        // Real-time streaming for agentic mode
        try {
          const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage.content,
              messages: messages, // Include full chat history
              useTools: useToolsMode,
              orchestratorModel: orchestratorModel,
              developmentMode: useAgenticMode,
              calendarId: selectedCalendarId,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('No reader available');
          }

          setLoadingStatus('');

          // Read the stream with proper chunk buffering for large JSON
          let finalResultReceived = false;
          let buffer = ''; // Buffer to accumulate incomplete chunks
          console.log('🌊🔥 STARTING TO READ STREAM');

          while (true) {
            const { done, value } = await reader.read();
            console.log('🌊🔥 STREAM READ:', { done, hasValue: !!value });

            if (done) break;

            const chunk = decoder.decode(value);
            buffer += chunk; // Accumulate chunks in buffer
            console.log('🌊🔥 RECEIVED CHUNK:', chunk.substring(0, 200), 'Buffer size:', buffer.length);

            // Process complete lines from buffer
            const lines = buffer.split('\n');

            // Keep the last line in buffer if it doesn't end with newline (incomplete)
            if (!buffer.endsWith('\n')) {
              buffer = lines.pop() || '';
            } else {
              buffer = '';
            }

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                console.log('🌊🔥 PROCESSING LINE:', line.substring(0, 100));
                try {
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr) continue; // Skip empty data lines

                  const data = JSON.parse(jsonStr);
                  console.log('🌊🔥 PARSED DATA:', { type: data.type, hasMessage: !!data.message, messageLength: data.message?.length || 0 });

                  if (data.type === 'progress') {
                    // Add progress message in real-time
                    setCurrentProgressMessages(prev => [...prev, data.message]);
                  } else if (data.type === 'final') {
                    // Handle final result
                    const duration = Date.now() - startTime;
                    console.log('📥🔥 FINAL RESULT RECEIVED IN STREAMING:', {
                      success: data.success,
                      messageLength: data.message?.length || 0,
                      hasMessage: !!data.message,
                      actualMessage: data.message?.substring(0, 200),
                      hasSteps: !!data.steps,
                      hasToolCalls: !!data.toolCalls,
                      hasData: !!data.data
                    });

                    // Transform streaming response to match expected format
                    const transformedResult = {
                      success: data.success,
                      message: data.message,
                      steps: data.steps || [],
                      toolCalls: data.toolCalls || [],
                      progressMessages: data.progressMessages || [],
                      approach: data.approach || 'agentic',
                      error: data.error,
                      data: data.data
                    };

                    console.log('🔄 Calling handleFinalResult with transformed result:', {
                      success: transformedResult.success,
                      messageLength: transformedResult.message?.length || 0,
                      message: transformedResult.message?.substring(0, 100) + (transformedResult.message?.length > 100 ? '...' : '')
                    });

                    // Process final result immediately
                    handleFinalResult(transformedResult, duration);

                    // Clear progress messages after final result is processed
                    setTimeout(() => {
                      setCurrentProgressMessages([]);
                    }, 2000);

                    finalResultReceived = true;
                    break; // Exit the inner for loop
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Streaming error');
                  }
                } catch (parseError) {
                  console.error('🌊💥 Failed to parse SSE data:', {
                    line: line.substring(0, 200),
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                    bufferSize: buffer.length
                  });
                  // Don't throw here - continue processing other lines
                }
              }
            }

            // Break outer loop if final result received
            if (finalResultReceived) break;
          }
        } catch (streamError) {
          console.error('Streaming failed, falling back to regular fetch:', streamError);

          // Fallback to regular fetch if streaming fails
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage.content,
              messages: messages,
              model: selectedModel,
              useTools: useToolsMode,
              orchestratorModel: orchestratorModel,
              developmentMode: useAgenticMode,
              calendarId: selectedCalendarId,
            }),
          });

          const result = await response.json();
          const duration = Date.now() - startTime;

          // Show progress messages one by one if we received them
          if (result.progressMessages && Array.isArray(result.progressMessages)) {
            setLoadingStatus('');
            result.progressMessages.forEach((progressMsg: string, index: number) => {
              setTimeout(() => {
                setCurrentProgressMessages(prev => [...prev, progressMsg]);
              }, index * 200); // Show each progress message with 200ms delay
            });

            // Clear progress messages before showing final result
            setTimeout(() => {
              setCurrentProgressMessages([]);
              handleFinalResult(result, duration);
            }, result.progressMessages.length * 200 + 1000);
          } else {
            handleFinalResult(result, duration);
          }
        }

      } else {
        // Regular fetch for non-agentic mode
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.content,
            messages: messages, // Include full chat history
            model: selectedModel,
            useTools: useToolsMode,
            orchestratorModel: orchestratorModel,
            developmentMode: useAgenticMode,
            calendarId: selectedCalendarId,
          }),
        });

        const result = await response.json();
        const duration = Date.now() - startTime;
         handleFinalResult(result, duration);
      }

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log the error
      addAPILog({
        service: 'ai',
        method: 'POST',
        endpoint: '/api/chat',
        error: error instanceof Error ? error.message : 'Network error',
        duration,
      });

      // More detailed error handling for network/parsing errors
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Network error: ${error instanceof Error ? error.message : 'Unable to connect to the server. Please check your connection and try again.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => {
        const errorMessages = [...prev, errorMessage];
        console.log('❌ Error message added. Total count:', errorMessages.length);

        // Persist to sessionStorage
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('chat-messages', JSON.stringify(errorMessages));
          } catch (error) {
            console.warn('Failed to save messages to sessionStorage:', error);
          }
        }

        return errorMessages;
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      // Don't clear currentSteps or currentProgressMessages here - let them finish their animation
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-semibold mb-4 text-high-contrast">Please Sign In</h2>
        <p className="text-medium-contrast">You need to be authenticated to use CalendarGPT.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Top bar with Clear Chat button */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="text-lg font-semibold text-high-contrast"></div>
        <button
          type="button"
          onClick={clearChat}
          className="btn btn-error btn-sm btn-outline"
          title="Clear chat history"
          disabled={messages.length === 0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          Clear Chat
        </button>
      </div>

      {/* Welcome Message */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="relative inline-block mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex flex-col items-center justify-center text-primary">
                <div className="text-xs font-semibold uppercase">
                  {new Date().toLocaleDateString('en-GB', { month: 'short' })}
                </div>
                <div className="text-xl font-bold">
                  {new Date().getDate()}
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 text-high-contrast">Welcome to CalendarGPT</h1>
            <p className="text-medium-contrast mb-4">
              I&apos;m your AI assistant with full access to your Google Calendar.
            </p>
            <div className="text-sm text-medium-contrast space-y-1 mb-4">
              <p>Try asking me to:</p>
              <p>• &quot;Summarize all events for nespola between March and June 2025&quot;</p>
              <p>• &quot;Create a meeting tomorrow at 2 PM&quot;</p>
              <p>• &quot;Show me my events for next week&quot;</p>
              <p>• &quot;Create daily report for TechCorp: worked on API integration&quot;</p>
            </div>
            <div className="text-xs text-info bg-info/10 p-3 rounded-lg border border-info/20">
              <p><strong>💡 Pro Tip:</strong> Keep &quot;Calendar Tools&quot; enabled for full functionality!</p>
              <p>• <strong>Calendar Tools:</strong> Gives me access to read/write your calendar</p>
              <p>• <strong>Agentic Mode:</strong> Enables multi-step reasoning for complex tasks</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat ${message.type === 'user' ? 'chat-end' : 'chat-start'}`}
          >
            <div className="chat-image avatar">
              <div className="w-10 rounded-full">
                {message.type === 'user' ? (
                  <div className="bg-primary text-primary-content w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold">
                    {session?.user?.name?.[0] || 'U'}
                  </div>
                ) : (
                  <div className="bg-accent text-accent-content w-10 h-10 rounded-full flex items-center justify-center">
                    📅
                  </div>
                )}
              </div>
            </div>
            <div className="chat-header">
              {message.type === 'user' ? 'You' : 'CalendarGPT'}
              <time className="text-xs opacity-50 ml-1">
                {message.timestamp.toLocaleTimeString('en-GB')}
              </time>
            </div>
            <div
              className={`chat-bubble ${
                message.type === 'user'
                  ? 'chat-bubble-primary'
                  : message.content.toLowerCase().includes('error') ||
                    message.content.toLowerCase().includes('failed') ||
                    message.content.toLowerCase().includes('unable') ||
                    message.content.toLowerCase().includes('network error')
                  ? 'chat-bubble-error'
                  : 'chat-bubble-accent'
              }`}
            >
              {/* Show error icon for error messages */}
              {(message.content.toLowerCase().includes('error') ||
                message.content.toLowerCase().includes('failed') ||
                message.content.toLowerCase().includes('unable') ||
                message.content.toLowerCase().includes('network error')) &&
                message.type === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-semibold">Error</span>
                </div>
              )}

              {/* Render message content */}
              {message.type === 'user' ? (
                // User messages as plain text
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                // Assistant messages as markdown with prose styling
                <div className="prose prose-sm max-w-none prose-invert">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Display progress messages if available (agentic mode) - visible to all users */}
              {message.progressMessages && message.progressMessages.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    ⚡ <span>AI Processing Logs</span>
                  </div>
                  <details className="collapse collapse-arrow bg-base-200/30 border border-base-300/30">
                    <summary className="collapse-title text-sm">
                      Show {message.progressMessages.length} processing steps
                    </summary>
                    <div className="collapse-content space-y-1">
                      {message.progressMessages.map((progressMsg, index) => (
                        <div key={index} className="text-xs p-2 bg-base-100/50 rounded border-l-2 border-accent/30">
                          {progressMsg}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Display orchestration steps if available (agentic mode) - only in dev mode */}
              {isDevelopmentMode && message.steps && message.steps.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    🤖 <span>AI Reasoning Steps</span>
                  </div>
                  {message.steps.map((step, index) => (
                    <div key={index} className="step-container">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`step-badge ${
                          step.type === 'analysis' ? 'badge-info' :
                          step.type === 'tool_call' ? 'badge-primary' :
                          step.type === 'evaluation' ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          {step.type}
                        </span>
                        <span className="font-mono text-xs opacity-60">{step.id}</span>
                      </div>
                      <div className="mb-2 text-sm leading-relaxed">{step.content}</div>
                      {step.reasoning && (
                        <div className="text-xs opacity-70 italic bg-base-200/30 p-2 rounded-lg border-l-2 border-primary/30">
                          💭 {step.reasoning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Display tool calls if available (tool mode) - only in dev mode */}
              {isDevelopmentMode && message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    🔧 <span>Tool Calls</span>
                  </div>
                  {message.toolCalls.map((toolCall, index) => (
                    <div key={index} className="step-container">
                      <div className="text-sm mb-2">
                        <span className="font-mono text-primary font-semibold bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                          {toolCall.tool}
                        </span>
                      </div>
                      {toolCall.result !== undefined && (
                        <div className="mockup-code text-xs rounded-lg overflow-hidden border border-base-300">
                          <pre className="p-3"><code>{safeStringify(toolCall.result)}</code></pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Display approach indicator - only in dev mode */}
              {isDevelopmentMode && message.approach && (
                <div className="mt-2">
                  <span className={`badge badge-xs ${
                    message.approach === 'agentic' ? 'badge-accent' :
                    message.approach === 'tools' ? 'badge-primary' :
                    'badge-neutral'
                  }`}>
                    {message.approach === 'agentic' ? 'Agentic Mode' :
                     message.approach === 'tools' ? 'Tool Mode' :
                     'Legacy Mode'}
                  </span>
                </div>
              )}

              {/* Display event data if available */}
              {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    📅 <span>Calendar Events</span>
                  </div>
                  {message.data.map((event: CalendarEvent) => (
                    <div key={event.id} className="event-card">
                      <div className="font-semibold text-high-contrast mb-2 text-base">{event.summary}</div>

                      {/* Date and Time */}
                      <div className="text-sm text-medium-contrast mb-3 space-y-1">
                        {event.start?.dateTime ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-primary">📅</span>
                              <span>{new Date(event.start.dateTime).toLocaleDateString('en-GB', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-primary">🕐</span>
                              <span>{new Date(event.start.dateTime).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}{event.end?.dateTime ? ` - ${new Date(event.end.dateTime).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}` : ''}</span>
                            </div>
                          </>
                        ) : event.start?.date ? (
                          <div className="flex items-center gap-2">
                            <span className="text-primary">📅</span>
                            <span>All day - {new Date(event.start.date).toLocaleDateString('en-GB', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Description */}
                      {event.description && (
                        <div className="event-card-description">
                          <div className="font-semibold mb-2 text-sm flex items-center gap-2">
                            <span className="text-primary">📄</span>
                            <span>Description</span>
                          </div>
                          <div className="prose prose-sm max-w-none prose-invert">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {event.description}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      {event.location && (
                        <div className="text-sm text-medium-contrast mb-2 flex items-center gap-2">
                          <span className="text-primary">📍</span>
                          <span>{event.location}</span>
                        </div>
                      )}

                      {/* Attendees */}
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="text-sm text-medium-contrast mb-2 flex items-center gap-2">
                          <span className="text-primary">👥</span>
                          <span>{event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {/* Status */}
                      {event.status && (
                        <div className="mt-3">
                          <span className={`badge badge-sm font-medium ${
                            event.status === 'confirmed' ? 'badge-success' :
                            event.status === 'tentative' ? 'badge-warning' :
                            'badge-neutral'
                          }`}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat chat-start">
            <div className="chat-image avatar">
              <div className="bg-accent text-accent-content w-10 h-10 rounded-full flex items-center justify-center">
                📅
              </div>
            </div>
            <div className="chat-bubble chat-bubble-accent">
              <div className="flex items-center gap-2">
                <span className="loading loading-dots loading-sm"></span>
                {loadingStatus && <span className="text-sm">{loadingStatus}</span>}
              </div>

              {/* Show real-time progress messages from orchestrator - visible to all users */}
              {currentProgressMessages.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    ⚡ <span>AI Progress</span>
                  </div>
                  {currentProgressMessages.map((message, index) => (
                    <div
                      key={index}
                      className="text-sm p-2 bg-base-200/30 rounded-lg border-l-2 border-accent/30 animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}

              {/* Show progressive steps during processing - only in dev mode */}
              {isDevelopmentMode && currentSteps.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    🔄 <span>Processing Steps</span>
                  </div>
                  {currentSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className="step-container animate-fade-in"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`step-badge ${
                          step.type === 'analysis' ? 'badge-info' :
                          step.type === 'tool_call' ? 'badge-primary' :
                          step.type === 'evaluation' ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          {step.type}
                        </span>
                        <span className="font-mono text-xs opacity-60">{step.id}</span>
                      </div>
                      <div className="mb-2 line-clamp-3 text-sm leading-relaxed">
                        {step.content.substring(0, 200)}...
                      </div>
                      {step.reasoning && (
                        <div className="text-xs opacity-70 italic bg-base-200/30 p-2 rounded-lg border-l-2 border-primary/30">
                          💭 {step.reasoning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t">
        {/* Model Selector and Mode Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          {/* Chat Model */}
          <div className="flex flex-col gap-2">
            <span className="text-sm text-base-content/70">Chat AI Model:</span>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>

          {/* Orchestrator Model (shown when tools are enabled) */}
          {useToolsMode && (
            <div className="flex flex-col gap-2">
              <OrchestratorModelSelector
                selectedModel={orchestratorModel}
                onModelChange={setOrchestratorModel}
              />
            </div>
          )}

          {/* Mode Controls */}
          <div className="flex flex-col gap-3">
            {/* Tool Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/70">Calendar Tools:</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={useToolsMode}
                onChange={(e) => {
                  setUseToolsMode(e.target.checked);
                  if (!e.target.checked) {
                    setUseAgenticMode(false); // Disable agentic mode if tools are disabled
                  }
                }}
              />
              <span className={`text-xs ${useToolsMode ? 'text-success' : 'text-warning'}`}>
                {useToolsMode ? 'CALENDAR ACCESS' : 'NO CALENDAR'}
              </span>
            </div>

            {/* Agentic Mode Toggle (only shown when tools are enabled) */}
            {useToolsMode && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-base-content/70">AI Mode:</span>
                <input
                  type="checkbox"
                  className="toggle toggle-accent toggle-sm"
                  checked={useAgenticMode}
                  onChange={(e) => setUseAgenticMode(e.target.checked)}
                />
                <span className={`text-xs ${useAgenticMode ? 'text-accent' : 'text-base-content/50'}`}>
                  {useAgenticMode ? 'AGENTIC' : 'SIMPLE'}
                </span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            className="input input-bordered flex-1"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn btn-primary"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
