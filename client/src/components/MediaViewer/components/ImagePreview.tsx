import React from 'react';
import { cn } from '@/utils/cn';
import { refreshSignedUrl } from '@/utils/refreshSignedUrl';

interface ImagePreviewProps {
  src: string | null;
  alt?: string | undefined;
  className?: string | undefined;
  onError?: () => void;
}

export function ImagePreview({ src, alt = 'Image preview', className, onError }: ImagePreviewProps) {
  const [didError, setDidError] = React.useState(false);
  const [resolvedSrc, setResolvedSrc] = React.useState<string | null>(src);
  const refreshAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    setDidError(false);
    refreshAttemptedRef.current = false;
    setResolvedSrc(src);
  }, [src]);

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
        const refreshed = await refreshSignedUrl(resolvedSrc, 'image');
        if (refreshed && refreshed !== resolvedSrc) {
          setResolvedSrc(refreshed);
          return;
        }
        setDidError(true);
        onError?.();
      }}
    />
  );
}

export default ImagePreview;
