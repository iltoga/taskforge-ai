// Development mode context for debugging API calls
'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface APICall {
  id: string;
  timestamp: Date;
  service: 'ai' | 'calendar';
  method: string;
  endpoint?: string;
  model?: string;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
  apiCalls: APICall[];
  addAPICall: (call: Omit<APICall, 'id' | 'timestamp'>) => void;
  clearAPILogs: () => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}

interface DevModeProviderProps {
  children: ReactNode;
}

export function DevModeProvider({ children }: DevModeProviderProps) {
  const [isDevMode, setIsDevMode] = useState(false);
  const [apiCalls, setApiCalls] = useState<APICall[]>([]);

  // Load dev mode state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('devMode');
      if (saved) {
        setIsDevMode(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load dev mode state:', error);
    }
  }, []);

  // Save dev mode state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('devMode', JSON.stringify(isDevMode));
    } catch (error) {
      console.warn('Failed to save dev mode state:', error);
    }
  }, [isDevMode]);

  const toggleDevMode = () => {
    setIsDevMode(prev => !prev);
  };

  const addAPICall = (call: Omit<APICall, 'id' | 'timestamp'>) => {
    if (!isDevMode) return; // Only log when dev mode is enabled

    const newCall: APICall = {
      ...call,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };

    setApiCalls(prev => [newCall, ...prev].slice(0, 100)); // Keep only last 100 calls
  };

  const clearAPILogs = () => {
    setApiCalls([]);
  };

  return (
    <DevModeContext.Provider
      value={{
        isDevMode,
        toggleDevMode,
        apiCalls,
        addAPICall,
        clearAPILogs,
      }}
    >
      {children}
    </DevModeContext.Provider>
  );
}
