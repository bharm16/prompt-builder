import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';

interface CanvasTopBarProps {
  title?: string;
  sessionName?: string;
  credits?: number | null;
}

export function CanvasTopBar({
  sessionName = 'Untitled session',
  credits,
}: CanvasTopBarProps): React.ReactElement {
  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-3 px-4">
      <div className="flex-1" />

      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-tool-text-dim transition-colors hover:text-muted"
      >
        {sessionName}
        <ChevronDown size={10} />
      </button>

      <div className="mx-1 h-4 w-px bg-tool-rail-border" />

      {typeof credits === 'number' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-tool-text-dim">
          <span className="h-[5px] w-[5px] rounded-full bg-success-400" />
          {credits} credits
        </span>
      ) : null}
    </div>
  );
}
