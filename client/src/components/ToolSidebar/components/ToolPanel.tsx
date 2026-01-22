import type { ReactElement } from 'react';
import { cn } from '@utils/cn';
import type { ToolPanelProps } from '../types';

export function ToolPanel({ activePanel, children }: ToolPanelProps): ReactElement {
  return (
    <div
      className={cn(
        'w-[400px] min-w-[400px] h-full',
        'bg-[#131416] flex flex-col overflow-hidden',
        'flex-none'
      )}
      data-panel={activePanel}
    >
      <div className="flex-1 flex flex-col bg-[#12131A]">{children}</div>
    </div>
  );
}
