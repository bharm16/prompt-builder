import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';

interface CanvasTopBarProps {
  title?: string;
  sessionName?: string;
  credits?: number | null;
}

export function CanvasTopBar({
  title = 'PromptCanvas',
  sessionName = 'Untitled session',
  credits,
}: CanvasTopBarProps): React.ReactElement {
  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-3 px-4">
      <span className="text-sm font-bold tracking-tight text-[#E2E6EF]">
        {title}
      </span>

      <div className="flex-1" />

      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-[#8B92A5] transition-colors hover:text-[#C0C5D4]"
      >
        {sessionName}
        <ChevronDown size={10} />
      </button>

      <div className="mx-1 h-4 w-px bg-[#1A1C22]" />

      {typeof credits === 'number' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#8B92A5]">
          <span className="h-[5px] w-[5px] rounded-full bg-[#4ADE80]" />
          {credits} credits
        </span>
      ) : null}
    </div>
  );
}
