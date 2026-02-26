import type { ReactElement } from 'react';
import { cn } from '@utils/cn';
import type { ToolPanelProps } from '../types';

export function ToolPanel({ activePanel, children }: ToolPanelProps): ReactElement {
  return (
    <div
      className={cn(
        'w-[400px] min-w-[400px] h-full',
        'bg-[linear-gradient(180deg,#11131A_0%,#0D0F16_100%)] border-l border-[#1A1C22]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] flex flex-col overflow-hidden',
        'relative text-white text-base leading-4',
        'flex-[25_1_0px] basis-0'
      )}
      data-panel={activePanel}
    >
      <div className="flex-1 flex flex-col bg-[rgba(15,18,26,0.7)]">{children}</div>
    </div>
  );
}
