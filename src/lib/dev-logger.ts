// Server-side development logger
export interface ServerLogEntry {
  timestamp: Date;
  service: 'ai' | 'calendar';
  method: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

class ServerDevLogger {
  private logs: ServerLogEntry[] = [];
  private maxLogs = 100;

  log(entry: Omit<ServerLogEntry, 'timestamp'>) {
    // Only log in development mode
    if (process.env.NODE_ENV !== 'development') return;

    const logEntry: ServerLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    // Add to beginning of array and limit size
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Also log to console in development
    console.log(`[DEV] ${entry.service.toUpperCase()} ${entry.method} ${entry.endpoint}`, {
      payload: entry.payload,
      response: entry.response,
      duration: entry.duration,
      error: entry.error,
    });
  }

  getLogs(): ServerLogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }
}

export const serverDevLogger = new ServerDevLogger();
