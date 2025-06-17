'use client';

import { ChevronDown, ChevronRight, Clock, Database, MessageSquare, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDevelopment } from '../contexts/DevelopmentContext';

interface ServerLogEntry {
  timestamp: string;
  service: 'ai' | 'calendar';
  method: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

export function DebugPanel() {
  const { isDevelopmentMode, apiLogs, clearAPILogs, isDebugPanelCollapsed, setDebugPanelCollapsed } = useDevelopment();
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [serverLogs, setServerLogs] = useState<ServerLogEntry[]>([]);

  // Fetch server logs when dev mode is enabled
  useEffect(() => {
    if (!isDevelopmentMode) return;

    const fetchServerLogs = async () => {
      try {
        const response = await fetch('/api/dev/logs');
        if (response.ok) {
          const logs = await response.json();
          setServerLogs(logs);
        }
      } catch (error) {
        console.error('Failed to fetch server logs:', error);
      }
    };

    fetchServerLogs();

    // Poll for new logs every 2 seconds
    const interval = setInterval(fetchServerLogs, 2000);
    return () => clearInterval(interval);
  }, [isDevelopmentMode]);

  if (!isDevelopmentMode) return null;

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getServiceIcon = (service: 'ai' | 'calendar') => {
    return service === 'ai' ? <MessageSquare className="w-4 h-4" /> : <Database className="w-4 h-4" />;
  };

  const getServiceBadge = (service: 'ai' | 'calendar') => {
    return service === 'ai' ? 'badge-primary' : 'badge-secondary';
  };

  // Combine client and server logs
  const allLogs = [...apiLogs, ...serverLogs.map(log => ({
    ...log,
    id: `server-${log.timestamp}`,
    timestamp: new Date(log.timestamp)
  }))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-base-300 bg-base-200/50">
        <div className="flex items-center gap-2">
          <div className="badge badge-warning badge-xs">DEV</div>
          <span className="text-xs font-semibold">API Debug Panel</span>
          <div className="badge badge-neutral badge-xs">{allLogs.length}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => {
              clearAPILogs();
              setServerLogs([]);
            }}
            disabled={allLogs.length === 0}
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setDebugPanelCollapsed(!isDebugPanelCollapsed)}
            title={isDebugPanelCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isDebugPanelCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isDebugPanelCollapsed && (
        <div className="overflow-y-auto max-h-[500px]">
          {allLogs.length === 0 ? (
            <div className="p-4 text-center text-base-content/60">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No API calls yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 p-3">
              {allLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                return (
                  <div key={log.id} className="border border-base-300 rounded-lg">
                    {/* Log Header */}
                    <div
                      className="flex items-center gap-2 p-3 cursor-pointer hover:bg-base-200 transition-colors"
                      onClick={() => toggleExpanded(log.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}

                      <div className={`badge badge-xs ${getServiceBadge(log.service)}`}>
                        {getServiceIcon(log.service)}
                      </div>

                      <span className="text-xs font-mono text-base-content/80">
                        {formatTime(log.timestamp)}
                      </span>

                      <span className="text-xs font-semibold truncate flex-1">
                        {log.method} {log.endpoint}
                      </span>

                      {log.duration && (
                        <div className="badge badge-neutral badge-xs">
                          <Clock className="w-2 h-2 mr-1" />
                          {log.duration}ms
                        </div>
                      )}

                      {log.error && (
                        <div className="badge badge-error badge-xs">
                          ERROR
                        </div>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {log.payload && (
                          <div>
                            <div className="text-xs font-semibold text-base-content/70 mb-1">
                              Payload:
                            </div>
                            <div className="bg-base-300 rounded p-2 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                              <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                            </div>
                          </div>
                        )}

                        {log.response && (
                          <div>
                            <div className="text-xs font-semibold text-base-content/70 mb-1">
                              Response:
                            </div>
                            <div className="bg-base-300 rounded p-2 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                              <pre>{JSON.stringify(log.response, null, 2)}</pre>
                            </div>
                          </div>
                        )}

                        {log.error && (
                          <div>
                            <div className="text-xs font-semibold text-error mb-1">
                              Error:
                            </div>
                            <div className="bg-error/10 border border-error/20 rounded p-2 text-xs">
                              {log.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
