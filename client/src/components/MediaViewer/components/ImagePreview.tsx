import React from 'react';
import { cn } from '@/utils/cn';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

interface ImagePreviewProps {
  src: string | null;
  storagePath?: string | null;
  assetId?: string | null;
  alt?: string | undefined;
  className?: string | undefined;
  onError?: () => void;
}

export function ImagePreview({
  src,
  storagePath,
  assetId,
  alt = 'Image preview',
  className,
  onError,
}: ImagePreviewProps) {
  const [didError, setDidError] = React.useState(false);
  const refreshAttemptedRef = React.useRef(false);
  const { url: resolvedSrc, refresh } = useResolvedMediaUrl({
    kind: 'image',
    url: src,
    storagePath: storagePath ?? null,
    assetId: assetId ?? null,
  });

  React.useEffect(() => {
    setDidError(false);
    refreshAttemptedRef.current = false;
  }, [src, storagePath, assetId]);

  const showFallback = !resolvedSrc || didError;

  if (showFallback) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-[rgb(30,34,40)] text-xs text-faint',
          className
        )}
      >
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc ?? ''}
      alt={alt}
      className={cn('h-full w-full rounded-md object-cover', className)}
      loading="lazy"
      onError={async () => {
        if (refreshAttemptedRef.current || !resolvedSrc) {
          setDidError(true);
          onError?.();
          return;
        }
        refreshAttemptedRef.current = true;
        await refresh('error');
        setDidError(true);
        onError?.();
      }}
    />
  );
}

export default ImagePreview;
