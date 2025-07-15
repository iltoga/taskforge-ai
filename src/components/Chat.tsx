'use client';

import { useCalendar } from '@/contexts/CalendarContext';
import { CalendarEvent } from '@/types/calendar';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { ModelType, supportsFileSearch } from '../appconfig/models';
import { useDevelopment } from '../contexts/DevelopmentContext';
import { ProcessedFile } from '../types/files';
import { EnabledToolsBadges } from './EnabledToolsBadges';
import { ModelSelector } from './ModelSelector';

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
  attachedFiles?: Array<{ id?: string; name: string; size: number; type: string }>;
}

export interface UploadedFile extends ProcessedFile {
  id?: string;
  fileId?: string;
  imageData?: string;
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
  // console.log('🔄 Chat component render - Message count:', messages.length, 'Status:', status);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [currentSteps, setCurrentSteps] = useState<Array<{ id: string; type: string; content: string; reasoning?: string }>>([]);
  const [currentProgressMessages, setCurrentProgressMessages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gpt-4.1-mini');

  // Always use the same model for orchestrator as for chat
  const orchestratorModel = selectedModel;
  // useToolsMode is now initialized based on enabled tools from API
  const [useToolsMode, setUseToolsMode] = useState<boolean | null>(null);
  // Store enabled tool categories for badge rendering
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Fetch enabled tools on mount and set useToolsMode accordingly
  useEffect(() => {
    async function fetchEnabledTools() {
      try {
        const res = await fetch('/api/enabled-tools');
        if (!res.ok) throw new Error('Failed to fetch enabled tools');
        const data = await res.json();
        // API returns an array of tool definitions; extract unique categories
        if (data && Array.isArray(data.enabledTools)) {
          type ToolDefinition = { category: string };
          const enabledToolsArr = data.enabledTools as ToolDefinition[];
          const categories: string[] = Array.from(new Set(enabledToolsArr.map((t) => t.category)));
          setEnabledTools(categories);
          setUseToolsMode(categories.length > 0);
        } else {
          setEnabledTools([]);
          setUseToolsMode(false);
        }
      } catch {
        setEnabledTools([]);
        setUseToolsMode(false);
      }
    }
    fetchEnabledTools();
  }, []);

  // Initialize agentic mode from localStorage or default to FALSE (SIMPLE mode)
  const [useAgenticMode, setUseAgenticMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('useAgenticMode');
        return saved ? JSON.parse(saved) : false; // Default to SIMPLE mode
      } catch {
        return false;
      }
    }
    return false; // Default to SIMPLE mode
  });

  // Persist agentic mode setting to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('useAgenticMode', JSON.stringify(useAgenticMode));
      } catch (error) {
        console.warn('Failed to save agentic mode setting:', error);
      }
    }
  }, [useAgenticMode]);

  // Function to clear chat messages, sessionStorage, and reset file search signature
  const clearChat = async () => {
    setMessages([]);
    setUploadedFiles([]);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('chat-messages');
      } catch (error) {
        console.warn('Failed to clear messages from sessionStorage:', error);
      }
      // Reset file search signature on the server
      try {
        await fetch('/api/chat/files/reset-signature', { method: 'POST' });
      } catch (error) {
        console.warn('Failed to reset file search signature:', error);
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
      attachedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
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
      setLoadingStatus('🔧 Processing with simple calendar tools...');
    } else {
      setLoadingStatus('� Processing with legacy mode...');
    }

    const startTime = Date.now();

    try {
      // Debug: Log the mode settings being used
      console.log('🔧 DEBUG: Sending request with modes:', {
        useToolsMode,
        useAgenticMode,
        selectedModel,
        orchestratorModel
      });

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
          fileIds: uploadedFiles.filter(f => f.id).map(f => f.id!),
          processedFiles: uploadedFiles.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type,
            fileId: f.fileId,
            imageData: f.imageData,
            isImage: f.isImage,
            convertedImages: f.convertedImages, // Include converted images array
            totalImageSize: f.totalImageSize, // Include total image size
            processAsImage: f.processAsImage // Include process as image flag
          })),
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
              fileIds: uploadedFiles.filter(f => f.id).map(f => f.id!),
              processedFiles: uploadedFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                fileId: f.fileId,
                imageData: f.imageData,
                isImage: f.isImage,
                convertedImages: f.convertedImages, // Include converted images array
                totalImageSize: f.totalImageSize, // Include total image size
                processAsImage: f.processAsImage // Include process as image flag
              })),
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
              fileIds: uploadedFiles.filter(f => f.id).map(f => f.id!),
              processedFiles: uploadedFiles.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                fileId: f.fileId,
                imageData: f.imageData,
                isImage: f.isImage,
                convertedImages: f.convertedImages, // Include converted images array
                totalImageSize: f.totalImageSize, // Include total image size
                processAsImage: f.processAsImage // Include process as image flag
              })),
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
            fileIds: uploadedFiles.filter(f => f.id).map(f => f.id!),
            processedFiles: uploadedFiles.map(f => ({
              name: f.name,
              size: f.size,
              type: f.type,
              fileId: f.fileId,
              imageData: f.imageData,
              isImage: f.isImage
            })),
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

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileUpload triggered');
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if current model supports file search
    if (!supportsFileSearch(selectedModel)) {
      alert('File upload is only available for OpenAI models that support Assistant API file search (GPT-4o, GPT-4.1 Mini, o4-mini, o4-mini-high).');
      return;
    }

    setIsUploadingFiles(true);
    setLoadingStatus('📁 Uploading files...');

    try {
      const newFiles: UploadedFile[] = [];

      for (const file of Array.from(files)) {
        // Check file size (limit to 512MB per OpenAI's limits)
        if (file.size > 512 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum file size is 512MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/chat/files', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload file');
        }

        const result = await response.json();

        // Handle new API response structure with uploads array
        if (result.success && result.uploads && Array.isArray(result.uploads)) {
          for (const upload of result.uploads as UploadedFile[]) {
            newFiles.push({
              id: upload.fileId || upload.name, // Use fileId for documents, name for images
              name: upload.name,
              size: upload.size,
              type: upload.type,
              fileId: upload.fileId,
              imageData: upload.imageData,
              isImage: upload.isImage,
              convertedImages: upload.convertedImages, // Preserve converted images array
              totalImageSize: upload.totalImageSize, // Preserve total image size
              processAsImage: upload.processAsImage // Preserve process as image flag
            });
          }
        } else {
          // Fallback to old response structure for compatibility
          newFiles.push({
            id: result.fileId,
            name: result.name,
            size: result.size,
            type: result.type,
          });
        }
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      setLoadingStatus('');

      if (newFiles.length > 0) {
        const fileNames = newFiles.map(f => f.name).join(', ');
        setLoadingStatus(`✅ Uploaded ${newFiles.length} file(s): ${fileNames}`);
        setTimeout(() => setLoadingStatus(''), 3000);
      }

    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLoadingStatus(`❌ Error uploading files: ${errorMessage}`);
      setTimeout(() => setLoadingStatus(''), 5000);
    } finally {
      setIsUploadingFiles(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Remove uploaded file
  const removeFile = async (fileId: string) => {
    try {
      // Delete file from OpenAI
      await fetch(`/api/chat/files?fileId=${fileId}`, {
        method: 'DELETE',
      });

      // Remove from local state
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (error) {
      console.error('Error removing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to remove file: ${errorMessage}`);
    }
  };


  if (status === 'loading' || useToolsMode === null) {
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
        <p className="text-medium-contrast">You need to be authenticated to use Calendar Assistant.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Top bar with Clear Chat button only */}
      <div className="flex items-center justify-end px-4 pt-4 pb-2">
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
            <h1 className="text-3xl font-bold mb-2 text-high-contrast">Welcome to Calendar Assistant</h1>
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
              {message.type === 'user' ? 'You' : 'Calendar Assistant'}
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
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Display attached files if available */}
              {message.attachedFiles && message.attachedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold opacity-70 flex items-center gap-2">
                    📎 <span>Attached Files</span>
                  </div>
                  <div className="space-y-1">
                    {message.attachedFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 p-2 bg-base-200/30 rounded-lg border border-base-300/30">
                        <span className="text-sm">📄</span>
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs opacity-60">
                          ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                    ))}
                  </div>
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
                        <div key={`progress-${message.id}-${index}`} className="text-xs p-2 bg-base-100/50 rounded border-l-2 border-accent/30">
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
                  {message.steps.map((step) => (
                    <div key={`step-${message.id}-${step.id}`} className="step-container">
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
                    <div key={`toolcall-${message.id}-${index}`} className="step-container">
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
                      key={`current-progress-${index}`}
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
                      key={`current-step-${step.id}-${index}`}
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
          {/* Unified Model Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-sm text-base-content/70">AI Model:</span>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
            />
          </div>

          {/* Mode Controls */}
          <div className="flex items-center gap-8 md:col-span-2 w-full">
            {/* Agentic Mode Toggle */}
            <div className="flex items-center gap-2 flex-shrink-0">
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
            {/* (Removed: EnabledToolsBadges now shown below input) */}
          </div>
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 relative">
          {/* File Upload Button (styled like ChatGPT) */}
          {supportsFileSearch(selectedModel) && (
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading || isUploadingFiles}
                multiple
                accept="*/*"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`btn btn-square btn-outline ${
                  isUploadingFiles ? 'btn-disabled' : 'hover:btn-primary'
                }`}
                title="Upload files (any type)"
              >
                {isUploadingFiles ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                )}
              </label>
            </div>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              supportsFileSearch(selectedModel)
                ? "Type your message here... (Files can be uploaded for context)"
                : "Type your message here..."
            }
            className="input input-bordered flex-1"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn btn-primary"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              'Send'
            )}
          </button>
        </form>

        {/* Display uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="mt-3 p-3 bg-base-200/30 rounded-lg border border-base-300/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-base-content/70">
                📎 {uploadedFiles.length} file(s) attached
              </span>
              <button
                onClick={() => setUploadedFiles([])}
                className="btn btn-xs btn-ghost text-error"
                disabled={isLoading}
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-base-100/50 rounded border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📄</span>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs opacity-60">
                      ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>
                  <button
                    onClick={() => file.id && removeFile(file.id)}
                    className="btn btn-xs btn-ghost text-error"
                    disabled={isLoading}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File search capability notice */}
        {supportsFileSearch(selectedModel) && uploadedFiles.length === 0 && (
          <div className="mt-2 text-xs text-info opacity-70">
            💡 This model supports file search - upload documents to add context to your conversations
          </div>
        )}

        {/* EnabledToolsBadges now shown below the chat input */}
        <div className="mt-4">
          <EnabledToolsBadges enabledTools={enabledTools} />
        </div>
      </div>
    </div>
  );
}
