import React from 'react';
import { Image } from 'lucide-react';
import { cn } from '@/utils/cn';

type HistoryThumbnailSize = 'sm' | 'md' | 'lg';
type HistoryThumbnailVariant = 'default' | 'muted';

interface HistoryThumbnailProps {
  src?: string | null;
  label?: string;
  size?: HistoryThumbnailSize;
  variant?: HistoryThumbnailVariant;
  isActive?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<HistoryThumbnailSize, string> = {
  sm: 'ps-thumb-size-sm',
  md: 'ps-thumb-size-md',
  lg: 'ps-thumb-size-lg',
};

export function HistoryThumbnail({
  src,
  label = 'Prompt thumbnail',
  size = 'sm',
  variant = 'default',
  isActive = false,
  className,
}: HistoryThumbnailProps): React.ReactElement {
  const hasSrc = typeof src === 'string' && src.trim().length > 0;
  const variantClass = variant === 'muted' ? 'ps-thumb-muted' : 'ps-thumb-placeholder';

  return (
    <div
      className={cn(
        'ps-thumb-frame',
        SIZE_CLASSES[size],
        isActive && 'ps-thumb-active',
        className
      )}
    >
      {hasSrc ? (
        <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center', variantClass)}>
          <Image className="h-4 w-4 text-faint" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
