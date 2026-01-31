import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Plus } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { KeyframeTile } from '@components/ToolSidebar/types';

interface KeyframeSlotsRowProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onRemoveKeyframe: (id: string) => void;
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
    <>
      <div className="h-[74px] px-3 pt-3 flex gap-1.5">
        {keyframeSlots.map((tile, index) => {
          const isEmpty = !tile;
          const canUpload = isEmpty && !isUploadDisabled;
          return (
            <div key={tile?.id ?? `keyframe-slot-${index}`} className="relative w-[110px] h-[62px]">
              <button
                type="button"
                className={cn(
                  'w-full h-full rounded-lg bg-[#1B1E23] shadow-[inset_0_0_0_1px_#2C3037]',
                  'flex items-center justify-center overflow-hidden',
                  isEmpty && 'cursor-pointer',
                  isEmpty && !canUpload && 'opacity-60 cursor-not-allowed',
                  isDragging && canUpload && 'shadow-[inset_0_0_0_1px_#B3AFFD]'
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
                  <img
                    src={tile.url}
                    alt={`Keyframe ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Plus className="w-4 h-4 text-white" />
                )}
              </button>

              {tile && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveKeyframe(tile.id);
                  }}
                  className="absolute right-1 top-1 rounded-md bg-[#1B1E23] px-2 py-1 text-[11px] text-[#A1AFC5] shadow-[inset_0_0_0_1px_#2C3037]"
                >
                  Clear
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
