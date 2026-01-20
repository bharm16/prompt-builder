import React from 'react';
import { cn } from '@/utils/cn';

interface ImagePreviewProps {
  src: string | null;
  alt?: string;
  className?: string;
  onError?: () => void;
}

export function ImagePreview({ src, alt = 'Image preview', className, onError }: ImagePreviewProps) {
  const [didError, setDidError] = React.useState(false);

  React.useEffect(() => {
    setDidError(false);
  }, [src]);

  const showFallback = !src || didError;

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
      src={src}
      alt={alt}
      className={cn('h-full w-full rounded-md object-cover', className)}
      loading="lazy"
      onError={() => {
        setDidError(true);
        onError?.();
      }}
    />
  );
}

export default ImagePreview;
