'use client';

import { createContext, ReactNode, useContext, useState } from 'react';

export interface APILog {
  id: string;
  timestamp: Date;
  service: 'ai' | 'calendar';
  method: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

interface DevelopmentContextType {
  isDevelopmentMode: boolean;
  toggleDevelopmentMode: () => void;
  apiLogs: APILog[];
  addAPILog: (log: Omit<APILog, 'id' | 'timestamp'>) => void;
  clearAPILogs: () => void;
  isDebugPanelCollapsed: boolean;
  setDebugPanelCollapsed: (collapsed: boolean) => void;
}

const DevelopmentContext = createContext<DevelopmentContextType | undefined>(undefined);

export function DevelopmentProvider({ children }: { children: ReactNode }) {
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false);
  const [apiLogs, setAPILogs] = useState<APILog[]>([]);
  const [isDebugPanelCollapsed, setIsDebugPanelCollapsed] = useState(true);

  const toggleDevelopmentMode = () => {
    setIsDevelopmentMode(prev => !prev);
  };

  const setDebugPanelCollapsed = (collapsed: boolean) => {
    setIsDebugPanelCollapsed(collapsed);
  };

  const addAPILog = (log: Omit<APILog, 'id' | 'timestamp'>) => {
    if (!isDevelopmentMode) return;

    const newLog: APILog = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setAPILogs(prev => [newLog, ...prev].slice(0, 50)); // Keep only last 50 logs
  };

  const clearAPILogs = () => {
    setAPILogs([]);
  };

  return (
    <DevelopmentContext.Provider
      value={{
        isDevelopmentMode,
        toggleDevelopmentMode,
        apiLogs,
        addAPILog,
        clearAPILogs,
        isDebugPanelCollapsed,
        setDebugPanelCollapsed,
      }}
    >
      {children}
    </DevelopmentContext.Provider>
  );
}

export function useDevelopment() {
  const context = useContext(DevelopmentContext);
  if (context === undefined) {
    throw new Error('useDevelopment must be used within a DevelopmentProvider');
  }
  return context;
}
