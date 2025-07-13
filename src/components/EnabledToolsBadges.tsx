import React from 'react';

interface EnabledToolsBadgesProps {
  enabledTools: string[]; // Array of enabled tool category names
  className?: string;
}

const TOOL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  calendar: { icon: <span>📅</span>, label: 'Calendar' },
  email: { icon: <span>✉️</span>, label: 'Email' },
  'file-search': { icon: <span>📁</span>, label: 'File Search' },
  web: { icon: <span>🌐</span>, label: 'Web' },
  passport: { icon: <span>🛂</span>, label: 'Passport Db' },
};

export function EnabledToolsBadges({ enabledTools, className = '' }: EnabledToolsBadgesProps) {
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <span className="text-xs font-semibold text-base-content/70 mb-2">Available Tools:</span>
      <div className="flex items-center gap-1">
        {enabledTools.map((tool) => (
          <span
            key={tool}
            className="badge badge-xs badge-outline gap-1 px-2 py-1 font-medium bg-base-200/60 border-base-300/60 text-base-content/80"
            title={TOOL_META[tool]?.label || tool}
          >
            {TOOL_META[tool]?.icon || '🔧'}
            <span className="ml-1 hidden sm:inline capitalize">{TOOL_META[tool]?.label || tool}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
