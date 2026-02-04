import React from 'react';
import { Play } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

interface VideoThumbnailProps {
  videoUrl: string | null;
  videoStoragePath?: string | null;
  videoAssetId?: string | null;
  thumbnailUrl?: string | null | undefined;
  thumbnailStoragePath?: string | null;
  thumbnailAssetId?: string | null;
  isGenerating: boolean;
  onPlay?: (() => void) | undefined;
}

export function VideoThumbnail({
  videoUrl,
  videoStoragePath,
  videoAssetId,
  thumbnailUrl,
  thumbnailStoragePath,
  thumbnailAssetId,
  isGenerating,
  onPlay,
}: VideoThumbnailProps): React.ReactElement {
  const videoRefreshAttemptedRef = React.useRef(false);
  const thumbnailRefreshAttemptedRef = React.useRef(false);
  const { url: resolvedVideoUrl, refresh: refreshVideo } = useResolvedMediaUrl({
    kind: 'video',
    url: videoUrl,
    storagePath: videoStoragePath ?? null,
    assetId: videoAssetId ?? null,
  });
  const { url: resolvedThumbnailUrl, refresh: refreshThumbnail } = useResolvedMediaUrl({
    kind: 'image',
    url: thumbnailUrl ?? null,
    storagePath: thumbnailStoragePath ?? null,
    assetId: thumbnailAssetId ?? null,
  });

  React.useEffect(() => {
    videoRefreshAttemptedRef.current = false;
    thumbnailRefreshAttemptedRef.current = false;
  }, [thumbnailUrl, videoUrl, videoStoragePath, videoAssetId, thumbnailStoragePath, thumbnailAssetId]);

  if (isGenerating) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-3">
        <div className="h-full w-full bg-gradient-to-r from-surface-3 via-surface-2 to-surface-3 bg-[length:200%_100%] animate-shimmer" />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-2">
      {resolvedVideoUrl ? (
        <video
          key={resolvedVideoUrl}
          src={resolvedVideoUrl}
          className="h-full w-full object-cover"
          controls
          onPlay={onPlay}
          onError={async () => {
            if (videoRefreshAttemptedRef.current || !resolvedVideoUrl) {
              return;
            }
            videoRefreshAttemptedRef.current = true;
            await refreshVideo('error');
          }}
        />
      ) : resolvedThumbnailUrl ? (
        <img
          src={resolvedThumbnailUrl}
          alt="Video thumbnail"
          className="h-full w-full object-cover"
          onError={async () => {
            if (thumbnailRefreshAttemptedRef.current || !resolvedThumbnailUrl) {
              return;
            }
            thumbnailRefreshAttemptedRef.current = true;
            await refreshThumbnail('error');
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-label-sm text-muted">
          No preview available
        </div>
      )}
      {!resolvedVideoUrl && (
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
