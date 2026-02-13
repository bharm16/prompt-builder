import React, { useCallback, useState, type ReactElement } from 'react';
import { Plus } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { hasGcsSignedUrlParams } from '@/utils/storageUrl';

interface StartFrameControlProps {
  startFrame: KeyframeTile | null;
  isUploadDisabled: boolean;
  onUploadFile: (file: File) => void | Promise<void>;
  onRequestUpload: () => void;
  onClear: () => void;
}

function StartFramePreview({ tile }: { tile: KeyframeTile }): ReactElement {
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
      alt="Start frame"
      className="h-full w-full object-cover rounded-lg"
    />
  );
}

export function StartFrameControl({
  startFrame,
  isUploadDisabled,
  onUploadFile,
  onRequestUpload,
  onClear,
}: StartFrameControlProps): ReactElement {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B92A5]">
          Start frame
        </span>
        {startFrame && (
          <button
            type="button"
            onClick={onClear}
            className="h-5 rounded-md border border-[#22252C] bg-[#0D0E12]/90 px-1.5 text-[10px] text-[#8B92A5] transition-colors hover:text-white"
          >
            Clear
          </button>
        )}
      </div>
      <button
        type="button"
        className={cn(
          'relative h-[66px] w-full rounded-lg border bg-[#16181E] transition-colors',
          startFrame ? 'border-[#3A3D46]' : 'border-dashed border-[#22252C]',
          isUploadDisabled && 'cursor-not-allowed opacity-60',
          !isUploadDisabled && 'cursor-pointer',
          isDragging && !isUploadDisabled && 'border-[#6C5CE7]'
        )}
        onClick={() => {
          if (isUploadDisabled) return;
          onRequestUpload();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!isUploadDisabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        aria-disabled={isUploadDisabled}
      >
        {startFrame ? (
          <>
            <StartFramePreview tile={startFrame} />
            <div className="absolute inset-0 rounded-lg bg-black/15 pointer-events-none" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center gap-2 text-[#555B6E]">
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Upload start frame</span>
          </div>
        )}
      </button>
    </div>
  );
}
