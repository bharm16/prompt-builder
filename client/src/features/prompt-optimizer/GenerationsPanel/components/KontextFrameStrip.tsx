import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface KontextFrameStripProps {
  frames: Array<string | null>;
  duration: number;
  isGenerating: boolean;
  onFrameClick?: (index: number) => void;
}

export function KontextFrameStrip({
  frames,
  duration,
  isGenerating,
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {slots.map((frame, index) => (
        <button
          key={`frame-${index}`}
          type="button"
          className={cn(
            'group overflow-hidden rounded-lg border border-border bg-surface-2 text-left',
            'transition hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
          )}
          onClick={() => onFrameClick?.(index)}
          disabled={!frame && !isGenerating}
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
            {frame ? (
              <img src={frame} alt={`Frame ${index + 1}`} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-surface-3" />
            )}
            {isGenerating && !frame && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-2/60 to-surface-3/90" />
            )}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {labels[index]}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
