import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface KontextFrameStripProps {
  frames: Array<string | null>;
  duration: number;
  isGenerating: boolean;
  progressPercent?: number | null;
  onFrameClick?: (index: number) => void;
}

export function KontextFrameStrip({
  frames,
  duration,
  isGenerating,
  progressPercent,
  onFrameClick,
}: KontextFrameStripProps): React.ReactElement {
  const normalizedFrames = frames.slice(0, 4);
  const slots =
    normalizedFrames.length >= 4
      ? normalizedFrames
      : [...normalizedFrames, ...Array.from({ length: 4 - normalizedFrames.length }, () => null)];
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 5;
  const labels = useMemo(() => {
    const step = slots.length > 1 ? safeDuration / (slots.length - 1) : safeDuration;
    return slots.map((_, index) => `${(step * index).toFixed(1)}s`);
  }, [slots, safeDuration]);

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {slots.map((frame, index) => (
        <button
          key={`frame-${index}`}
          type="button"
          className={cn(
            'group overflow-hidden rounded-md border border-border bg-surface-2 text-left',
            'transition hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
          )}
          onClick={() => onFrameClick?.(index)}
          disabled={!frame && !isGenerating}
        >
          <div
            className={cn(
              'relative aspect-[4/3] overflow-hidden bg-surface-3',
              isGenerating &&
                !frame &&
                'bg-gradient-to-r from-surface-3 via-surface-2 to-surface-3 bg-[length:200%_100%] animate-shimmer'
            )}
          >
            {isGenerating && index === 0 && (
              <div className="absolute top-2 left-2 z-10 rounded-md bg-black/80 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-warning">
                {typeof progressPercent === 'number'
                  ? `${progressPercent}% Complete`
                  : 'Generating'}
              </div>
            )}
            {frame ? (
              <img
                src={frame}
                alt={`Frame ${index + 1}`}
                className={cn('h-full w-full object-cover', !isGenerating && 'animate-fade-in')}
              />
            ) : (
              <div className="h-full w-full bg-surface-3" />
            )}
            <div className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
              {labels[index]}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
