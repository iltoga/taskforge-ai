'use client';

import { Code, Monitor } from 'lucide-react';
import { useDevelopment } from '../contexts/DevelopmentContext';

export function DevelopmentToggle() {
  const { isDevelopmentMode, toggleDevelopmentMode } = useDevelopment();

  return (
    <div className="flex items-center gap-2">
      <div className="form-control">
        <label className="label cursor-pointer gap-3">
          <span className="label-text flex items-center gap-2">
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">Dev Mode</span>
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={isDevelopmentMode}
            onChange={toggleDevelopmentMode}
          />
        </label>
      </div>

      {isDevelopmentMode && (
        <div className="badge badge-warning badge-sm gap-1">
          <Monitor className="w-3 h-3" />
          Development
        </div>
      )}
    </div>
  );
}
