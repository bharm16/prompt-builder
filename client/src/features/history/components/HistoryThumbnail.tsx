import React from 'react';
import { Image } from '@promptstudio/system/components/ui';
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
  const [didError, setDidError] = React.useState<boolean>(false);

  React.useEffect(() => {
    setDidError(false);
  }, [src]);

  const normalizedSrc = typeof src === 'string' ? src.trim() : '';
  const hasSrc = normalizedSrc.length > 0;
  const showFallback = !hasSrc || didError;

  const fallbackChar = React.useMemo(() => {
    const raw = (label ?? '').trim();
    if (!raw) return '';
    const match = raw.match(/[A-Za-z0-9]/);
    return (match?.[0] ?? '').toUpperCase();
  }, [label]);

  const variantClass =
    variant === 'muted' ? 'ps-thumb-muted' : 'ps-thumb-placeholder';

  return (
    <div
      className={cn(
        'ps-thumb-frame flex flex-shrink-0 items-center justify-center bg-[rgb(44,48,55)]',
        SIZE_CLASSES[size],
        isActive && 'ps-thumb-active',
        className
      )}
    >
      {showFallback ? (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            variantClass
          )}
        >
          {fallbackChar ? (
            <span className="text-[14px] font-medium leading-none text-[rgb(198,201,210)]">
              {fallbackChar}
            </span>
          ) : (
            <Image className="h-4 w-4 text-faint" aria-hidden="true" />
          )}
        </div>
      ) : (
        <img
          src={normalizedSrc}
          alt={label}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setDidError(true)}
        />
      )}
    </div>
  );
}
