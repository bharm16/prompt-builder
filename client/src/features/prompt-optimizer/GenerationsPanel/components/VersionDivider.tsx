import React from 'react';
import { cn } from '@/utils/cn';

interface VersionDividerProps {
  versionLabel: string;
  promptChanged: boolean;
  className?: string;
}

export function VersionDivider({
  versionLabel,
  promptChanged,
  className,
}: VersionDividerProps): React.ReactElement {
  return (
    <div
      className={cn('flex items-center gap-3 py-2', className)}
      role="separator"
      aria-label={`Version ${versionLabel}${promptChanged ? ', prompt changed' : ''}`}
    >
      <div className="h-px flex-1 bg-[rgb(41,44,50)]" aria-hidden="true" />
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[rgb(107,114,128)] uppercase tracking-wide">
          {versionLabel}
        </span>
        {promptChanged && (
          <span className="text-[10px] font-medium text-[rgb(147,130,100)] bg-[rgb(147,130,100)]/10 px-1.5 py-0.5 rounded">
            prompt changed
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-[rgb(41,44,50)]" aria-hidden="true" />
    </div>
  );
}
