import React from 'react';
import { Play } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import { refreshSignedUrl } from '@/utils/refreshSignedUrl';

interface VideoThumbnailProps {
  videoUrl: string | null;
  thumbnailUrl?: string | null | undefined;
  isGenerating: boolean;
  onPlay?: (() => void) | undefined;
}

export function VideoThumbnail({
  videoUrl,
  thumbnailUrl,
  isGenerating,
  onPlay,
}: VideoThumbnailProps): React.ReactElement {
  const [resolvedVideoUrl, setResolvedVideoUrl] = React.useState<string | null>(videoUrl);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = React.useState<string | null | undefined>(
    thumbnailUrl
  );
  const videoRefreshAttemptedRef = React.useRef(false);
  const thumbnailRefreshAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    setResolvedVideoUrl(videoUrl);
    setResolvedThumbnailUrl(thumbnailUrl);
    videoRefreshAttemptedRef.current = false;
    thumbnailRefreshAttemptedRef.current = false;
  }, [thumbnailUrl, videoUrl]);

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
              setResolvedVideoUrl(null);
              return;
            }
            videoRefreshAttemptedRef.current = true;
            const refreshed = await refreshSignedUrl(resolvedVideoUrl, 'video');
            if (refreshed && refreshed !== resolvedVideoUrl) {
              setResolvedVideoUrl(refreshed);
              return;
            }
            setResolvedVideoUrl(null);
          }}
        />
      ) : resolvedThumbnailUrl ? (
        <img
          src={resolvedThumbnailUrl}
          alt="Video thumbnail"
          className="h-full w-full object-cover"
          onError={async () => {
            if (thumbnailRefreshAttemptedRef.current || !resolvedThumbnailUrl) {
              setResolvedThumbnailUrl(null);
              return;
            }
            thumbnailRefreshAttemptedRef.current = true;
            const refreshed = await refreshSignedUrl(resolvedThumbnailUrl, 'image');
            if (refreshed && refreshed !== resolvedThumbnailUrl) {
              setResolvedThumbnailUrl(refreshed);
              return;
            }
            setResolvedThumbnailUrl(null);
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
