import React, { useMemo } from 'react';
import { GridFour, Play, WarningCircle } from '@promptstudio/system/components/ui';
import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import { cn } from '@/utils/cn';

interface CanvasGenerationStripProps {
  generations: Generation[];
  selectedGenerationId: string | null;
  onSelectGeneration: (generationId: string) => void;
}

type GenerationBucket = 'draft' | 'render' | 'preview';

const resolveTimestamp = (generation: Generation): number =>
  generation.completedAt ?? generation.createdAt ?? 0;

const resolveThumbnail = (generation: Generation): string | null => {
  if (
    typeof generation.thumbnailUrl === 'string' &&
    generation.thumbnailUrl.trim().length > 0
  ) {
    return generation.thumbnailUrl;
  }
  const firstUrl = generation.mediaUrls[0];
  if (typeof firstUrl === 'string' && firstUrl.trim().length > 0) {
    return firstUrl;
  }
  return null;
};

const resolveBucket = (generation: Generation): GenerationBucket => {
  if (generation.mediaType === 'image-sequence') return 'preview';
  return generation.tier;
};

const resolvePrefix = (bucket: GenerationBucket): 'D' | 'R' | 'P' => {
  if (bucket === 'draft') return 'D';
  if (bucket === 'render') return 'R';
  return 'P';
};

export function CanvasGenerationStrip({
  generations,
  selectedGenerationId,
  onSelectGeneration,
}: CanvasGenerationStripProps): React.ReactElement | null {
  const orderedGenerations = useMemo(
    () => [...generations].sort((left, right) => resolveTimestamp(right) - resolveTimestamp(left)),
    [generations]
  );

  const labels = useMemo(() => {
    const counts: Record<GenerationBucket, number> = {
      draft: 0,
      render: 0,
      preview: 0,
    };

    return orderedGenerations.map((generation) => {
      const bucket = resolveBucket(generation);
      counts[bucket] += 1;
      return `${resolvePrefix(bucket)}${counts[bucket]}`;
    });
  }, [orderedGenerations]);

  if (orderedGenerations.length === 0) return null;

  return (
    <div
      className="absolute left-5 top-1/2 z-20 flex -translate-y-[60%] flex-col items-center gap-2"
      data-testid="canvas-generation-strip"
    >
      {orderedGenerations.map((generation, index) => {
        const thumbnailUrl = resolveThumbnail(generation);
        const isSelected = generation.id === selectedGenerationId;
        const isPending =
          generation.status === 'pending' || generation.status === 'generating';
        const isFailed = generation.status === 'failed';
        const label = labels[index] ?? `G${index + 1}`;

        return (
          <button
            key={generation.id}
            type="button"
            onClick={() => onSelectGeneration(generation.id)}
            className={cn(
              'relative h-[57px] w-[57px] overflow-hidden rounded-[10px] border-2 outline-none transition-all',
              isSelected
                ? 'border-[#E2E6EF] opacity-100'
                : 'border-transparent opacity-70 hover:opacity-[0.9]'
            )}
            aria-pressed={isSelected}
            aria-label={`Select generation ${label}`}
            data-testid={`generation-strip-item-${generation.id}`}
          >
            {isPending ? (
              <div
                className="flex h-full w-full animate-pulse items-center justify-center bg-[#1A1C22]"
                data-testid={`generation-strip-pending-${generation.id}`}
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#3A3E4C] border-t-[#E2E6EF]" />
              </div>
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={label}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1A1C22] to-[#0D0E12]" />
            )}

            {generation.mediaType === 'image-sequence' ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-white/80">
                <GridFour size={10} weight="bold" aria-hidden="true" />
              </span>
            ) : (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-white/80">
                <Play size={10} weight="fill" aria-hidden="true" />
              </span>
            )}

            {isFailed ? (
              <span
                className="absolute inset-0 flex items-center justify-center bg-black/35 text-[#EF4444]/90"
                data-testid={`generation-strip-failed-${generation.id}`}
              >
                <WarningCircle size={14} weight="bold" aria-hidden="true" />
              </span>
            ) : null}

            <span className="absolute bottom-[3px] right-1 text-[8px] font-bold text-white/70">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
