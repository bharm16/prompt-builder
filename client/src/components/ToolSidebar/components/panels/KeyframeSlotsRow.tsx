import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Plus } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { hasGcsSignedUrlParams } from '@/utils/storageUrl';

interface KeyframeSlotsRowProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onRemoveKeyframe: (id: string) => void;
}

function KeyframeSlotImage({
  tile,
  index,
}: {
  tile: KeyframeTile;
  index: number;
}): ReactElement {
  const shouldResolveUrl = Boolean(
    tile.storagePath || tile.assetId || (tile.url && hasGcsSignedUrlParams(tile.url))
  );

  const { url: resolvedUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: tile.url,
    storagePath: tile.storagePath ?? null,
    assetId: tile.assetId ?? null,
    enabled: shouldResolveUrl,
  });

  return (
    <img
      src={resolvedUrl || tile.url}
      alt={`Keyframe ${index + 1}`}
      className="w-full h-full object-cover rounded-lg"
    />
  );
}

export function KeyframeSlotsRow({
  keyframes,
  isUploadDisabled,
  onRequestUpload,
  onUploadFile,
  onRemoveKeyframe,
}: KeyframeSlotsRowProps): ReactElement {
  const [isDragging, setIsDragging] = useState(false);

  const keyframeSlots = useMemo(
    () => Array.from({ length: 3 }, (_, index) => keyframes[index] ?? null),
    [keyframes]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (isUploadDisabled) return;

      const file = event.dataTransfer.files?.[0];
      if (file) {
        void onUploadFile(file);
      }
    },
    [isUploadDisabled, onUploadFile]
  );

  return (
    <div className="flex gap-1.5">
      {keyframeSlots.map((tile, index) => {
        const isEmpty = !tile;
        const canUpload = isEmpty && !isUploadDisabled;
        return (
          <div key={tile?.id ?? `keyframe-slot-${index}`} className="relative w-[104px] h-[60px]">
            <button
              type="button"
              className={cn(
                'w-full h-full rounded-lg bg-[#16181E] border flex items-center justify-center overflow-hidden transition-colors',
                tile ? 'border-[#3A3D46]' : 'border-dashed border-[#22252C]',
                isEmpty && 'cursor-pointer',
                isEmpty && !canUpload && 'opacity-60 cursor-not-allowed',
                isDragging && canUpload && 'border-[#6C5CE7]'
              )}
              onClick={() => {
                if (!canUpload) return;
                onRequestUpload();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (canUpload) {
                  setIsDragging(true);
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              aria-disabled={!canUpload}
            >
              {tile ? (
                <>
                  <KeyframeSlotImage tile={tile} index={index} />
                  <div className="absolute inset-0 bg-black/15 pointer-events-none" />
                  <span className="absolute left-1.5 bottom-1 text-[8px] font-semibold text-white/70 pointer-events-none">
                    Frame {index + 1}
                  </span>
                </>
              ) : (
                <Plus className="w-3.5 h-3.5 text-[#555B6E]" />
              )}
            </button>

            {tile && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveKeyframe(tile.id);
                }}
                className="absolute right-1.5 top-1.5 h-5 px-1.5 rounded-md bg-[#0D0E12]/90 border border-[#22252C] text-[10px] text-[#8B92A5] hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
