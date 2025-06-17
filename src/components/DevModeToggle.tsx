'use client';

import { useDevMode } from '@/contexts/DevModeContext';
import { Code, Monitor } from 'lucide-react';

export function DevModeToggle() {
  const { isDevMode, toggleDevMode } = useDevMode();

  return (
    <div className="tooltip tooltip-bottom" data-tip={isDevMode ? "Exit Development Mode" : "Enter Development Mode"}>
      <button
        onClick={toggleDevMode}
        className={`btn btn-square btn-sm ${
          isDevMode
            ? 'btn-warning text-warning-content'
            : 'btn-ghost'
        }`}
        aria-label={isDevMode ? "Exit Development Mode" : "Enter Development Mode"}
      >
        {isDevMode ? (
          <Code className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export function DevModeIndicator() {
  const { isDevMode } = useDevMode();

  if (!isDevMode) return null;

  return (
    <div className="alert alert-warning shadow-lg mb-4">
      <Code className="w-5 h-5" />
      <div>
        <h3 className="font-bold">Development Mode</h3>
        <div className="text-xs">API calls and payloads are being logged for debugging</div>
      </div>
    </div>
  );
}
