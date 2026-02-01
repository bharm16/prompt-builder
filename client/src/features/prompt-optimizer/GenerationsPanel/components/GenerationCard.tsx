import React, { memo } from 'react';
import {
  ArrowClockwise,
  Check,
  DotsThree,
  Download,
  WarningCircle,
  X,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';

import { cn } from '@/utils/cn';
import { ContinueSceneButton } from '@/features/continuity/components/ContinueSceneButton';
import { extractVideoContentAssetId } from '@/utils/storageUrl';
import { ImagePreview } from '@/components/MediaViewer/components/ImagePreview';

import type { Generation } from '../types';
import { formatRelativeTime, getModelConfig } from '../config/generationConfig';
import { useGenerationProgress } from '../hooks/useGenerationProgress';
import { GenerationBadge } from './GenerationBadge';
import { KontextFrameStrip } from './KontextFrameStrip';
import { VideoThumbnail } from './VideoThumbnail';

interface GenerationCardProps {
  generation: Generation;
  onRetry?: ((generation: Generation) => void) | undefined;
  onDelete?: ((generation: Generation) => void) | undefined;
  onDownload?: ((generation: Generation) => void) | undefined;
  onCancel?: ((generation: Generation) => void) | undefined;
  onSelectFrame?: ((url: string, index: number, generationId: string) => void) | undefined;
  onClearSelectedFrame?: (() => void) | undefined;
  selectedFrameUrl?: string | null | undefined;
  isActive?: boolean | undefined;
  onClick?: (() => void) | undefined;
}

const statusLabel = (status: Generation['status']): string => {
  if (status === 'generating') return 'Generating';
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  return 'Pending';
};

export const GenerationCard = memo(function GenerationCard({
  generation,
  onRetry,
  onDelete,
  onDownload,
  onCancel,
  onSelectFrame,
  onClearSelectedFrame,
  selectedFrameUrl = null,
  isActive = false,
  onClick,
}: GenerationCardProps): React.ReactElement {
  const config = getModelConfig(generation.model);
  const timeLabel = formatRelativeTime(
    generation.completedAt ?? generation.createdAt
  );
  const { progressPercent, isGenerating, isCompleted, isFailed } =
    useGenerationProgress(generation);
  const mediaUrl = generation.mediaUrls[0] ?? null;
  const continuitySourceId =
    generation.mediaAssetIds?.[0] ?? (mediaUrl ? extractVideoContentAssetId(mediaUrl) : null);
  const showRetry = generation.status === 'failed' && Boolean(onRetry);
  const showDownload =
    generation.tier === 'render' &&
    generation.status === 'completed' &&
    Boolean(mediaUrl) &&
    Boolean(onDownload);
  const canSelectFrames =
    generation.mediaType === 'image-sequence' &&
    generation.status === 'completed' &&
    generation.mediaUrls.length > 0 &&
    Boolean(onSelectFrame);
  const hasSelectedFrame =
    canSelectFrames &&
    Boolean(selectedFrameUrl) &&
    generation.mediaUrls.includes(selectedFrameUrl);
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
          (() => {
            if (generation.status === 'completed' && generation.mediaUrls.length === 0) {
              console.warn('[GenerationCard] Image-sequence generation completed but no mediaUrls:', {
                id: generation.id,
                model: generation.model,
                mediaType: generation.mediaType,
              });
            }
            return (
              <KontextFrameStrip
                frames={
                  generation.mediaUrls.length
                    ? generation.mediaUrls
                    : Array.from({ length: 4 }, () => null)
                }
                duration={generation.duration ?? 5}
                isGenerating={isGenerating}
                progressPercent={progressPercent}
                selectedFrameUrl={selectedFrameUrl}
                onFrameClick={
                  canSelectFrames
                    ? (index, url) => {
                        if (!url) return;
                        if (selectedFrameUrl === url) {
                          onClearSelectedFrame?.();
                          return;
                        }
                        onSelectFrame?.(url, index, generation.id);
                      }
                    : undefined
                }
              />
            );
          })()
        ) : (
          <VideoThumbnail
            videoUrl={mediaUrl}
            thumbnailUrl={generation.thumbnailUrl ?? undefined}
            isGenerating={isGenerating}
          />
        )}
      </div>

      {hasSelectedFrame && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
          <Check size={14} weight="bold" className="text-accent" aria-hidden="true" />
          <span className="text-xs text-foreground flex-1">
            Frame selected as keyframe
          </span>
          {onClearSelectedFrame && (
            <button
              type="button"
              className="text-muted hover:text-foreground transition-colors"
              onClick={(event) => {
                event.stopPropagation();
                onClearSelectedFrame();
              }}
              aria-label="Clear selected keyframe"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {generation.faceSwapUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
          <div className="h-10 w-10 overflow-hidden rounded-md border border-border">
            <ImagePreview src={generation.faceSwapUrl} alt="Face swap preview" />
          </div>
          <span className="text-xs text-foreground flex-1">Face swap applied</span>
        </div>
      )}

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
        {generation.mediaType === 'video' && generation.status === 'completed' && (
          <ContinueSceneButton
            sourceVideoId={continuitySourceId}
            defaultName={`Scene Continuity - ${config?.label ?? 'Video'}`}
            className={showRetry || showDownload ? '' : 'ml-auto'}
          />
        )}
      </div>
    </div>
  );
});

GenerationCard.displayName = 'GenerationCard';
