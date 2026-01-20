import React from 'react';
import { Play } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';

interface VideoThumbnailProps {
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  isGenerating: boolean;
  onPlay?: () => void;
}

export function VideoThumbnail({
  videoUrl,
  thumbnailUrl,
  isGenerating,
  onPlay,
}: VideoThumbnailProps): React.ReactElement {
  if (isGenerating) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-3">
        <div className="h-full w-full bg-gradient-to-r from-surface-3 via-surface-2 to-surface-3 bg-[length:200%_100%] animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-2">
      {videoUrl ? (
        <video
          src={videoUrl}
          className="h-full w-full object-cover"
          controls
          onPlay={onPlay}
        />
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt="Video thumbnail" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-label-sm text-muted">
          No preview available
        </div>
      )}
      {!videoUrl && (
        <button
          type="button"
          onClick={onPlay}
          className={cn(
            'absolute inset-0 flex items-center justify-center text-white',
            'bg-black/30 transition hover:bg-black/40'
          )}
          aria-label="Play preview"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur">
            <Play size={18} weight="fill" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
