import React from 'react';
import { cn } from '@/utils/cn';
import { useReferenceImages } from './hooks/useReferenceImages';
import type { ReferenceImage } from './api/referenceImageApi';

interface ReferenceImageLibraryProps {
  selectedImageId?: string | null;
  onSelect?: (image: ReferenceImage) => void;
  className?: string;
  title?: string;
}

export function ReferenceImageLibrary({
  selectedImageId = null,
  onSelect,
  className,
  title = 'Reference library',
}: ReferenceImageLibraryProps): React.ReactElement {
  const { images, isLoading, error, refresh } = useReferenceImages();

  return (
    <div className={cn('rounded-lg border border-border bg-surface-1 p-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="text-xs text-muted">Saved images you can reuse as keyframes.</div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs font-semibold text-accent"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3">
        {isLoading && (
          <div className="text-xs text-muted">Loading reference images...</div>
        )}
        {!isLoading && error && <div className="text-xs text-error">{error}</div>}
        {!isLoading && !error && images.length === 0 && (
          <div className="text-xs text-muted">No reference images yet.</div>
        )}

        {!isLoading && !error && images.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                className={cn(
                  'relative overflow-hidden rounded-md border border-transparent transition',
                  selectedImageId === image.id
                    ? 'border-accent ring-2 ring-accent'
                    : 'hover:border-border'
                )}
                onClick={() => onSelect?.(image)}
              >
                <img
                  src={image.thumbnailUrl || image.imageUrl}
                  alt={image.label || 'Reference image'}
                  className="h-16 w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReferenceImageLibrary;
