'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { CalendarProvider } from '../contexts/CalendarContext';
import { DevelopmentProvider } from '../contexts/DevelopmentContext';
import { DebugPanel } from './DebugPanel';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <DevelopmentProvider>
        <CalendarProvider>
          {children}
          <DebugPanel />
        </CalendarProvider>
      </DevelopmentProvider>
    </SessionProvider>
  );
}
