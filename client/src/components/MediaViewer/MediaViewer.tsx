import React from 'react';
import { cn } from '@/utils/cn';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { ImagePreview } from './components/ImagePreview';
import { VideoPlayer } from './components/VideoPlayer';

interface MediaViewerProps {
  storagePath: string | null;
  contentType?: string | null;
  initialUrl?: string | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string;
}

function isVideoSource(storagePath: string | null, contentType?: string | null): boolean {
  if (contentType && contentType.startsWith('video/')) return true;
  if (!storagePath) return false;
  return /\.(mp4|webm|mov)$/i.test(storagePath);
}

export function MediaViewer({
  storagePath,
  contentType,
  initialUrl,
  title,
  className,
  autoPlay,
  controls,
  loop,
  muted,
  poster,
}: MediaViewerProps) {
  const isVideo = isVideoSource(storagePath, contentType);
  const { url: viewUrl, loading, error } = useResolvedMediaUrl({
    kind: isVideo ? 'video' : 'image',
    url: initialUrl ?? null,
    storagePath: storagePath ?? null,
    enabled: Boolean(storagePath || initialUrl),
  });

  if (loading) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-[rgb(30,34,40)] text-xs text-faint',
          className
        )}
      >
        Loading media...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-[rgb(30,34,40)] text-xs text-faint',
          className
        )}
      >
        {error}
      </div>
    );
  }

  return isVideo ? (
    <VideoPlayer
      src={viewUrl}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      poster={poster}
    />
  ) : (
    <ImagePreview src={viewUrl} alt={title} className={className} />
  );
}

export default MediaViewer;
