import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';
import { ImageUpload } from '@/features/preview';
import { ReferenceImageLibrary } from '@/features/reference-images';
import type { Generation } from '../types';

type KeyframeSource = 'preview' | 'upload' | 'library';

export interface SelectedKeyframe {
  url: string;
  source: KeyframeSource;
  generationId?: string;
  referenceId?: string;
}

interface KeyframeSelectorProps {
  generations: Generation[];
  selectedKeyframe: SelectedKeyframe | null;
  onSelect: (keyframe: SelectedKeyframe) => void;
  onClear?: () => void;
  className?: string;
}

const MAX_FRAME_CHOICES = 8;

export function KeyframeSelector({
  generations,
  selectedKeyframe,
  onSelect,
  onClear,
  className,
}: KeyframeSelectorProps): React.ReactElement {
  const frameOptions = useMemo(() => {
    const candidates = generations
      .filter(
        (generation) =>
          generation.mediaType === 'image-sequence' &&
          generation.status === 'completed' &&
          generation.mediaUrls.length > 0
      )
      .sort((a, b) => {
        const aTime = a.completedAt ?? a.createdAt;
        const bTime = b.completedAt ?? b.createdAt;
        return bTime - aTime;
      });

    const options: Array<{ url: string; generationId: string }> = [];
    for (const generation of candidates) {
      for (const url of generation.mediaUrls) {
        options.push({ url, generationId: generation.id });
        if (options.length >= MAX_FRAME_CHOICES) {
          return options;
        }
      }
    }
    return options;
  }, [generations]);

  return (
    <div className={cn('space-y-3 rounded-lg border border-border bg-surface-2 p-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Keyframe</div>
          <div className="text-xs text-muted">
            Choose a frame from your drafts or upload one.
          </div>
        </div>
        {selectedKeyframe && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-accent"
          >
            Clear
          </button>
        )}
      </div>

      <ImageUpload
        onUploadComplete={(payload) => {
          onSelect({ url: payload.imageUrl, source: 'upload' });
        }}
      />

      {frameOptions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground">Recent draft frames</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {frameOptions.map((frame) => (
              <button
                key={`${frame.generationId}-${frame.url}`}
                type="button"
                onClick={() =>
                  onSelect({
                    url: frame.url,
                    generationId: frame.generationId,
                    source: 'preview',
                  })
                }
                className={cn(
                  'relative overflow-hidden rounded-md border border-transparent transition',
                  selectedKeyframe?.url === frame.url &&
                    selectedKeyframe?.generationId === frame.generationId
                    ? 'border-accent ring-2 ring-accent'
                    : 'hover:border-border'
                )}
              >
                <img
                  src={frame.url}
                  alt="Draft frame"
                  className="h-16 w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <ReferenceImageLibrary
        selectedImageId={
          selectedKeyframe?.source === 'library' ? selectedKeyframe.referenceId ?? null : null
        }
        onSelect={(image) =>
          onSelect({
            url: image.imageUrl,
            source: 'library',
            referenceId: image.id,
          })
        }
      />
    </div>
  );
}

export default KeyframeSelector;
