import React from 'react';
import {
  ArrowClockwise,
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
  isActive?: boolean;
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
  isActive = false,
}: GenerationCardProps): React.ReactElement {
  const config = getModelConfig(generation.model);
  const timeLabel = formatRelativeTime(
    generation.completedAt ?? generation.createdAt
  );
  const isGenerating =
    generation.status === 'pending' || generation.status === 'generating';
  const mediaUrl = generation.mediaUrls[0] ?? null;
  const showRetry = generation.status === 'failed' && Boolean(onRetry);
  const showDownload =
    generation.tier === 'render' &&
    generation.status === 'completed' &&
    Boolean(mediaUrl) &&
    Boolean(onDownload);

  return (
    <div
      className={cn(
        'bg-surface-2 rounded-xl border p-4 transition-colors',
        isActive ? 'border-border-strong' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2">
        <GenerationBadge tier={generation.tier} />
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <div className="text-body-sm text-foreground truncate font-medium">
            {config?.label ?? generation.model}
          </div>
          <div className="text-label-sm text-muted shrink-0">{timeLabel}</div>
        </div>
        <div
          className={cn(
            'text-label-sm text-muted ml-auto flex items-center gap-1 font-medium',
            generation.status === 'completed' && 'text-success',
            generation.status === 'failed' && 'text-error'
          )}
        >
          {statusLabel(generation.status)}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-7 w-7 rounded-md"
          aria-label="More actions"
          onClick={() => onDelete?.(generation)}
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
                onClick={() => onRetry(generation)}
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
                onClick={() => onDownload(generation)}
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
