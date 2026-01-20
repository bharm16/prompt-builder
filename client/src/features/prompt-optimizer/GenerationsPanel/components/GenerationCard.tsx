import React from 'react';
import {
  ArrowClockwise,
  Check,
  DotsThree,
  Download,
  WarningCircle,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { cn } from '@/utils/cn';
import { formatRelativeTime, getModelConfig } from '../config/generationConfig';
import type { Generation } from '../types';
import { GenerationBadge } from './GenerationBadge';
import { KontextFrameStrip } from './KontextFrameStrip';
import { VideoThumbnail } from './VideoThumbnail';

interface GenerationCardProps {
  generation: Generation;
  onRetry?: (generation: Generation) => void;
  onDelete?: (generation: Generation) => void;
  onDownload?: (generation: Generation) => void;
  onCancel?: (generation: Generation) => void;
  isActive?: boolean;
  onClick?: () => void;
}

const statusLabel = (status: Generation['status']): string => {
  if (status === 'generating') return 'Generating';
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  return 'Pending';
};

export function GenerationCard({
  generation,
  onRetry,
  onDelete,
  onDownload,
  onCancel,
  isActive = false,
  onClick,
}: GenerationCardProps): React.ReactElement {
  const config = getModelConfig(generation.model);
  const timeLabel = formatRelativeTime(
    generation.completedAt ?? generation.createdAt
  );
  const isGenerating =
    generation.status === 'pending' || generation.status === 'generating';
  const isCompleted = generation.status === 'completed';
  const isFailed = generation.status === 'failed';
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    if (!isGenerating) return;
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, [isGenerating]);

  const progressPercent = React.useMemo(() => {
    if (isCompleted) return 100;
    if (!isGenerating) return null;

    const expectedMs =
      generation.mediaType === 'image-sequence'
        ? 18_000
        : generation.tier === 'render'
          ? 65_000
          : 35_000;
    const elapsedMs = Math.max(0, now - generation.createdAt);
    const timePercent = Math.max(
      0,
      Math.min(95, Math.floor((elapsedMs / expectedMs) * 100))
    );

    const totalSlots = generation.mediaType === 'image-sequence' ? 4 : 1;
    const urlPercent = Math.max(
      0,
      Math.min(
        99,
        Math.round((Math.min(generation.mediaUrls.length, totalSlots) / totalSlots) * 100)
      )
    );

    return Math.max(timePercent, urlPercent);
  }, [
    generation.createdAt,
    generation.mediaType,
    generation.mediaUrls.length,
    generation.tier,
    isCompleted,
    isGenerating,
    now,
  ]);
  const mediaUrl = generation.mediaUrls[0] ?? null;
  const showRetry = generation.status === 'failed' && Boolean(onRetry);
  const showDownload =
    generation.tier === 'render' &&
    generation.status === 'completed' &&
    Boolean(mediaUrl) &&
    Boolean(onDownload);
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick) return;
    const target = event.target as Element;
    if (target.closest('button, a, input, textarea, select, video')) {
      return;
    }
    onClick();
  };

  return (
    <div
      className={cn(
        'bg-surface-2 rounded-xl border p-4 transition-colors',
        isGenerating
          ? 'border-accent/50 hover:border-accent animate-border-pulse'
          : isActive
            ? 'border-border-strong'
            : 'border-border',
        onClick && 'cursor-pointer',
        onClick && !isGenerating && 'hover:border-border-strong'
      )}
      onClick={onClick ? handleClick : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        <GenerationBadge tier={generation.tier} status={generation.status} />
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <div className="text-body-sm text-foreground truncate font-medium">
            {config?.label ?? generation.model}
          </div>
          <div className="text-label-sm text-muted shrink-0">{timeLabel}</div>
        </div>
        {isGenerating ? (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-label-sm text-muted">
              {typeof progressPercent === 'number' ? `${progressPercent}%` : '...'}
            </span>
            {onCancel && (
              <button
                type="button"
                className="text-label-sm text-muted hover:text-foreground transition-colors"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancel(generation);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        ) : isCompleted ? (
          <div className="ml-auto flex items-center gap-1 text-label-sm font-medium text-success">
            <Check size={14} weight="bold" className="text-success" aria-hidden="true" />
            Completed
          </div>
        ) : (
          <div
            className={cn(
              'text-label-sm text-muted ml-auto flex items-center gap-1 font-medium',
              isFailed && 'text-error'
            )}
          >
            {statusLabel(generation.status)}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          className="h-7 w-7 rounded-md"
          aria-label="More actions"
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(generation);
          }}
        >
          <DotsThree size={18} weight="bold" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-3">
        {generation.mediaType === 'image-sequence' ? (
          <KontextFrameStrip
            frames={
              generation.mediaUrls.length
                ? generation.mediaUrls
                : Array.from({ length: 4 }, () => null)
            }
            duration={generation.duration ?? 5}
            isGenerating={isGenerating}
            progressPercent={progressPercent}
          />
        ) : (
          <VideoThumbnail
            videoUrl={mediaUrl}
            thumbnailUrl={generation.thumbnailUrl ?? undefined}
            isGenerating={isGenerating}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {generation.status === 'failed' && (
          <span className="text-error inline-flex items-center gap-1 text-label-sm">
            <WarningCircle size={14} aria-hidden="true" />
            {generation.error ?? 'Generation failed'}
          </span>
        )}

        {(showRetry || showDownload) && (
          <div className="ml-auto flex items-center gap-2">
            {showRetry && onRetry && (
              <Button
                type="button"
                variant="ghost"
                className="text-label-sm h-8 gap-1 px-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry(generation);
                }}
              >
                <ArrowClockwise size={14} aria-hidden="true" />
                Retry
              </Button>
            )}
            {showDownload && mediaUrl && onDownload && (
              <Button
                type="button"
                variant="ghost"
                className="text-label-sm h-8 gap-1 px-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onDownload(generation);
                }}
              >
                <Download size={14} aria-hidden="true" />
                Download
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
