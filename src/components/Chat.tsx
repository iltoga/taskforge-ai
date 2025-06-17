'use client';

import { CalendarEvent } from '@/types/calendar';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ModelType } from '../config/models';
import { useDevelopment } from '../contexts/DevelopmentContext';
import { ModelSelector } from './ModelSelector';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: CalendarEvent | CalendarEvent[];
}

// Utility function to detect and render formatted text (HTML/Markdown)
function FormattedText({ content }: { content: string }) {
  // Detect if content contains HTML tags
  const hasHTMLTags = /<[^>]*>/g.test(content);

  // Detect if content contains common Markdown patterns
  const hasMarkdownPatterns = /[*_#`[\]]/g.test(content) || /^\s*[>\-+*]\s/m.test(content);

  if (hasHTMLTags) {
    // Render as HTML with react-markdown
    return (
      <div className="text-xs markdown-content">
        <ReactMarkdown
          rehypePlugins={[rehypeRaw]}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  } else if (hasMarkdownPatterns) {
    // Render as Markdown
    return (
      <div className="text-xs markdown-content">
        <ReactMarkdown>
          {content}
        </ReactMarkdown>
      </div>
    );
  } else {
    // Render as plain text with line breaks preserved
    return <div className="whitespace-pre-wrap">{content}</div>;
  }
}

export function Chat() {
  const { data: session, status } = useSession();
  const { addAPILog } = useDevelopment();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gpt-4o-mini');

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

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
        },
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          model: selectedModel, // Include selected model
        }),
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

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
      if (result.success) {
        assistantContent = result.message;
      } else {
        // Show detailed error message from API
        assistantContent = result.error || 'An unknown error occurred';

        // Add helpful context and actions for specific errors
        if (response.status === 401) {
          if (assistantContent.includes('Google Calendar authentication')) {
            assistantContent += '\n\n🔄 To fix this: Sign out and sign in again to refresh your Google Calendar permissions.';
          } else {
            assistantContent += ' (Authentication required)';
          }
        } else if (response.status === 403) {
          assistantContent += '\n\n🔧 To fix this: Please ensure you granted calendar access during sign-in.';
        } else if (response.status === 429) {
          assistantContent += ' (Rate limit exceeded)';
        } else if (response.status === 500) {
          assistantContent += ' (Server error)';
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        data: result.data,
      };

      setMessages(prev => [...prev, assistantMessage]);
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
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
        <h2 className="text-2xl font-semibold mb-4">Please Sign In</h2>
        <p className="text-gray-600">You need to be authenticated to use CalendarGPT.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
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
            <h1 className="text-3xl font-bold mb-2">Welcome to CalendarGPT</h1>
            <p className="text-gray-600 mb-4">
              I&apos;m your friendly, professional assistant for calendar management.
            </p>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Try asking me to:</p>
              <p>• &quot;Create a meeting tomorrow at 2 PM&quot;</p>
              <p>• &quot;Show me my events for next week&quot;</p>
              <p>• &quot;Create daily report for TechCorp: worked on API integration&quot;</p>
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
              {message.content}

              {/* Display event data if available */}
              {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.data.map((event: CalendarEvent) => (
                    <div key={event.id} className="bg-base-100 p-3 rounded text-sm border border-base-300">
                      <div className="font-semibold text-base mb-1">{event.summary}</div>

                      {/* Date and Time */}
                      <div className="text-xs text-base-content/70 mb-2">
                        {event.start?.dateTime ? (
                          <>
                            <div>📅 {new Date(event.start.dateTime).toLocaleDateString('en-GB')}</div>
                            <div>🕐 {new Date(event.start.dateTime).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}{event.end?.dateTime ? ` - ${new Date(event.end.dateTime).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}` : ''}</div>
                          </>
                        ) : event.start?.date ? (
                          <div>📅 All day - {new Date(event.start.date).toLocaleDateString('en-GB')}</div>
                        ) : null}
                      </div>

                      {/* Description */}
                      {event.description && (
                        <div className="text-xs text-base-content/80 mb-2 p-2 bg-base-200 rounded">
                          <div className="font-semibold mb-1">Description:</div>
                          <FormattedText content={event.description} />
                        </div>
                      )}

                      {/* Location */}
                      {event.location && (
                        <div className="text-xs text-base-content/70 mb-1">
                          📍 {event.location}
                        </div>
                      )}

                      {/* Attendees */}
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="text-xs text-base-content/70 mb-1">
                          👥 {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Status */}
                      {event.status && (
                        <div className="text-xs">
                          <span className={`badge badge-xs ${
                            event.status === 'confirmed' ? 'badge-success' :
                            event.status === 'tentative' ? 'badge-warning' :
                            'badge-neutral'
                          }`}>
                            {event.status}
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
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t">
        {/* Model Selector */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-base-content/70">AI Model:</span>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
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
