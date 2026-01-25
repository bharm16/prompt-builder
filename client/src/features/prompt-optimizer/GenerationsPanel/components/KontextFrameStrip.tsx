import React, { useMemo, useState } from 'react';
import { Check, WarningCircle } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';

interface KontextFrameStripProps {
  frames: Array<string | null>;
  duration: number;
  isGenerating: boolean;
  progressPercent?: number | null;
  onFrameClick?: (index: number, url: string | null) => void;
  selectedFrameUrl?: string | null;
}

export function KontextFrameStrip({
  frames,
  duration,
  isGenerating,
  progressPercent,
  onFrameClick,
  selectedFrameUrl,
}: KontextFrameStripProps): React.ReactElement {
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());

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

  const handleImageError = (index: number) => {
    console.warn('[KontextFrameStrip] Image failed to load:', {
      index,
      url: slots[index]?.slice(0, 100),
    });
    setFailedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {slots.map((frame, index) => {
        const isSelected = Boolean(frame && selectedFrameUrl && frame === selectedFrameUrl);
        const canSelect = Boolean(frame && onFrameClick);
        const hasFailed = failedIndices.has(index);

        return (
          <button
            key={`frame-${index}-${frame ?? 'empty'}`}
            type="button"
            className={cn(
              'group overflow-hidden rounded-md border bg-surface-2 text-left',
              isSelected
                ? 'border-accent ring-2 ring-accent'
                : 'border-border transition hover:border-border-strong',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
            )}
            onClick={() => {
              if (!frame || hasFailed) return;
              onFrameClick?.(index, frame);
            }}
            disabled={(!frame && !isGenerating) || hasFailed}
            aria-pressed={isSelected}
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
              {frame && !hasFailed ? (
                <img
                  src={frame}
                  alt={`Frame ${index + 1}`}
                  className={cn('h-full w-full object-cover', !isGenerating && 'animate-fade-in')}
                  onError={() => handleImageError(index)}
                />
              ) : hasFailed ? (
                 <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted">
                    <WarningCircle size={20} className="text-error" aria-hidden="true" />
                    <span className="text-[10px] font-medium">Failed</span>
                 </div>
              ) : (
                <div className="h-full w-full bg-surface-3" />
              )}
              {canSelect && !isSelected && !hasFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Use as keyframe
                </div>
              )}
              {isSelected && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={12} weight="bold" aria-hidden="true" />
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                {labels[index]}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
