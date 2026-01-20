import React from 'react';
import {
  ArrowClockwise,
  DotsThree,
  Download,
  WarningCircle,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { cn } from '@/utils/cn';
import {
  formatCost,
  formatRelativeTime,
  getModelConfig,
} from '../config/generationConfig';
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
  const cost = generation.actualCost ?? generation.estimatedCost ?? null;
  const timeLabel = formatRelativeTime(
    generation.completedAt ?? generation.createdAt
  );
  const isGenerating =
    generation.status === 'pending' || generation.status === 'generating';
  const mediaUrl = generation.mediaUrls[0] ?? null;

  return (
    <div
      className={cn(
        'bg-surface-2 rounded-xl border p-4 transition-colors',
        isActive ? 'border-accent/60 ps-glow-accent' : 'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        <GenerationBadge tier={generation.tier} />
        <div className="min-w-0 flex-1">
          <div className="text-body-sm text-foreground truncate font-semibold">
            {config?.label ?? generation.model}
          </div>
          <div className="text-label-sm text-muted">
            {formatCost(cost)} · {timeLabel}
          </div>
        </div>
        <div className="text-label-sm text-muted flex items-center gap-1">
          {statusLabel(generation.status)}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8 rounded-full"
          aria-label="More actions"
          onClick={() => onDelete?.(generation)}
        >
          <DotsThree size={18} weight="bold" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-4">
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

      <div className="text-label-sm text-muted mt-4 flex flex-wrap items-center gap-2">
        <span className="border-border rounded-full border px-2 py-0.5">
          {generation.aspectRatio ?? 'Aspect n/a'}
        </span>
        <span className="border-border rounded-full border px-2 py-0.5">
          {generation.duration ? `${generation.duration}s` : 'Duration n/a'}
        </span>
        <span className="border-border rounded-full border px-2 py-0.5">
          {generation.fps ? `${generation.fps} fps` : 'FPS n/a'}
        </span>
        <span className="ml-auto" aria-hidden="true" />
        {generation.status === 'failed' && (
          <span className="text-error inline-flex items-center gap-1">
            <WarningCircle size={14} aria-hidden="true" />
            {generation.error ?? 'Generation failed'}
          </span>
        )}
        {generation.status === 'failed' && onRetry && (
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
        {generation.tier === 'render' &&
          generation.status === 'completed' &&
          mediaUrl &&
          onDownload && (
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
    </div>
  );
}
