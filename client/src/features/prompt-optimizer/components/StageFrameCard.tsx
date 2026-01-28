import React from 'react';
import { Check, Play, X } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';

export type FrameStatus = 'ready' | 'queued' | 'generating' | 'idle' | 'error';

export interface StageFrameMeta {
  title: string;
  subtitle: string | null;
  timestampLabel: string;
  description?: string;
}

export interface StageFrameCardProps {
  frame: StageFrameMeta;
  index: number;
  thumbnailUrl: string | null;
  status: FrameStatus;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_CONFIG: Record<
  FrameStatus,
  { icon: string; label: string; dotClass: string; textClass: string }
> = {
  ready: {
    icon: '✓',
    label: 'Ready',
    dotClass: 'bg-success',
    textClass: 'text-success',
  },
  queued: {
    icon: '◌',
    label: 'Queued',
    dotClass: 'bg-warning',
    textClass: 'text-warning',
  },
  generating: {
    icon: '◐',
    label: 'Generating',
    dotClass: 'bg-accent animate-pulse',
    textClass: 'text-accent',
  },
  idle: {
    icon: '−',
    label: 'Idle',
    dotClass: 'bg-border',
    textClass: 'text-muted',
  },
  error: {
    icon: '✕',
    label: 'Error',
    dotClass: 'bg-error',
    textClass: 'text-error',
  },
};

const StatusBadge = ({
  status,
}: {
  status: FrameStatus;
}): React.ReactElement => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'text-label-sm inline-flex items-center gap-1.5 font-medium',
        config.textClass
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-full', config.dotClass)}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  );
};

export const StageFrameCard = ({
  frame,
  index,
  thumbnailUrl,
  status,
  isSelected,
  onClick,
}: StageFrameCardProps): React.ReactElement => {
  return (
    <button
      type="button"
      className={cn(
        'group w-full overflow-hidden rounded-xl border text-left transition-all duration-200',
        'focus-visible:ring-accent focus-visible:ring-offset-surface-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        isSelected
          ? 'border-accent/60 ps-glow-accent'
          : 'border-border hover:border-border-strong'
      )}
      data-selected={isSelected ? 'true' : 'false'}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      {/* Thumbnail */}
      <div className="bg-surface-3 relative aspect-[16/10]">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Frame ${index + 1} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="bg-surface-2 text-muted flex h-8 w-8 items-center justify-center rounded-full">
              <Play size={14} weight="fill" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Frame label badge */}
        <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          <span className="text-label-sm font-semibold text-white">
            Frame {index + 1}
          </span>
        </div>

        {/* Bottom gradient */}
        <div className="from-surface-2 pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent" />
      </div>

      {/* Info section */}
      <div className="bg-surface-2 px-3 py-2">
        {/* Timecode and status row */}
        <div className="flex items-center justify-between">
          <span className="text-label-sm text-muted font-mono">
            {frame.timestampLabel}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* Description */}
        <p className="text-body-sm text-muted mt-1 truncate">
          {frame.description ?? frame.subtitle ?? `Scene ${index + 1}`}
        </p>
      </div>
    </button>
  );
};

StageFrameCard.displayName = 'StageFrameCard';

export default StageFrameCard;
