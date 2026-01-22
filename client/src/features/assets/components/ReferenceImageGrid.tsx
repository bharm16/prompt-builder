import React from 'react';
import type { AssetReferenceImage } from '@shared/types/asset';
import { Button } from '@promptstudio/system/components/ui/button';

interface ReferenceImageGridProps {
  images: AssetReferenceImage[];
  onDelete: (imageId: string) => void;
  onSetPrimary: (imageId: string) => void;
}

export function ReferenceImageGrid({
  images,
  onDelete,
  onSetPrimary,
}: ReferenceImageGridProps): React.ReactElement {
  if (!images.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-2 p-4 text-center text-sm text-muted">
        No reference images yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((image) => (
        <div key={image.id} className="group relative overflow-hidden rounded-lg border border-border">
          <img src={image.thumbnailUrl || image.url} alt="" className="h-32 w-full object-cover" />
          {image.isPrimary && (
            <span className="absolute left-2 top-2 rounded-full bg-surface-1/90 px-2 py-0.5 text-xs text-foreground">
              Primary
            </span>
          )}
          <div className="absolute inset-0 flex items-end justify-between bg-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100">
            {!image.isPrimary && (
              <Button
                type="button"
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => onSetPrimary(image.id)}
              >
                Set primary
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs text-white"
              onClick={() => onDelete(image.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ReferenceImageGrid;
