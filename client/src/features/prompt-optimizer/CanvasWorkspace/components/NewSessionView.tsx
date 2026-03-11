import React from 'react';
import { useCreditBalance } from '@/contexts/CreditBalanceContext';
import { cn } from '@/utils/cn';

interface NewSessionViewProps {
  className?: string;
}

export function NewSessionView({
  className,
}: NewSessionViewProps): React.ReactElement {
  const { balance } = useCreditBalance();

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex flex-col justify-between',
        className
      )}
      data-testid="new-session-view"
    >
      <div className="flex flex-1 flex-col items-center justify-start px-6 pt-[16vh]">
        <div className="mb-8 flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="4"
              width="20"
              height="16"
              rx="3"
              stroke="#555B6E"
              strokeWidth="1.5"
            />
            <path d="M10 9.5L15.5 12.5L10 15.5V9.5Z" fill="#555B6E" />
          </svg>
          <span className="text-xl font-semibold tracking-[-0.02em] text-[#555B6E]">
            Video
          </span>
        </div>
        <p className="max-w-[420px] text-center text-sm leading-relaxed text-[#4B5063]">
          Start with a scene, subject, or motion cue. The editor stays live while the workspace
          grows around it.
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center justify-end px-5 pb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-[6px] w-[6px] rounded-full bg-[#34D399]" />
          <span className="text-[11px] font-medium text-[#555B6E]">
            {typeof balance === 'number' ? `${balance} cr` : '— cr'}
          </span>
        </div>
      </div>
    </div>
  );
}
