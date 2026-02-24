import React, { useCallback, useRef, useState } from 'react';
import { Image, X } from '@promptstudio/system/components/ui';
import type { SidebarUploadedImage } from '@components/ToolSidebar/types';
import type { VideoReferenceImage } from '@/features/prompt-optimizer/context/generationControlsStoreTypes';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { hasGcsSignedUrlParams } from '@/utils/storageUrl';
import { cn } from '@/utils/cn';

interface VideoReferencesPopoverProps {
  references: VideoReferenceImage[];
  maxSlots?: number | undefined;
  onAddReference: (reference: Omit<VideoReferenceImage, 'id'>) => void;
  onRemoveReference: (id: string) => void;
  onUpdateReferenceType: (id: string, type: 'asset' | 'style') => void;
  onUploadSidebarImage?: ((file: File) => Promise<SidebarUploadedImage | null>) | undefined;
  disabled?: boolean | undefined;
}

interface VideoReferenceRowProps {
  reference: VideoReferenceImage;
  index: number;
  onRemove: (id: string) => void;
  onUpdateType: (id: string, type: 'asset' | 'style') => void;
}

function VideoReferenceRow({
  reference,
  index,
  onRemove,
  onUpdateType,
}: VideoReferenceRowProps): React.ReactElement {
  const shouldResolveUrl = Boolean(
    reference.storagePath || reference.assetId || hasGcsSignedUrlParams(reference.url)
  );

  const { url: resolvedUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: reference.url,
    storagePath: reference.storagePath ?? null,
    assetId: reference.assetId ?? null,
    enabled: shouldResolveUrl,
  });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#22252C] bg-[#0D0E12] px-2 py-1.5">
      <div className="h-7 w-7 overflow-hidden rounded border border-[#22252C] bg-[#16181E]">
        <img
          src={resolvedUrl || reference.url}
          alt={`Reference ${index + 1}`}
          className="h-full w-full object-cover"
        />
      </div>
      <select
        value={reference.referenceType}
        onChange={(event) =>
          onUpdateType(reference.id, event.target.value as 'asset' | 'style')
        }
        className="h-6 rounded border border-[#2C3037] bg-[#16181E] px-1.5 text-[10px] text-[#A1AFC5]"
        aria-label={`Reference type ${index + 1}`}
      >
        <option value="asset">Asset</option>
        <option value="style">Style</option>
      </select>
      <button
        type="button"
        className="ml-auto flex h-5 w-5 items-center justify-center rounded text-[#555B6E] hover:bg-[#1C1E26] hover:text-[#E2E6EF]"
        onClick={() => onRemove(reference.id)}
        aria-label={`Remove reference ${index + 1}`}
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function VideoReferencesPopover({
  references,
  maxSlots = 3,
  onAddReference,
  onRemoveReference,
  onUpdateReferenceType,
  onUploadSidebarImage,
  disabled = false,
}: VideoReferencesPopoverProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isLimitReached = references.length >= maxSlots;
  const canUpload = Boolean(onUploadSidebarImage) && !disabled && !isUploading && !isLimitReached;

  const handleUpload = useCallback(
    async (file: File): Promise<void> => {
      if (!onUploadSidebarImage || disabled || isLimitReached) return;
      setIsUploading(true);
      try {
        const uploaded = await onUploadSidebarImage(file);
        if (!uploaded) return;
        onAddReference({
          url: uploaded.url,
          referenceType: 'asset',
          source: 'upload',
          ...(uploaded.storagePath ? { storagePath: uploaded.storagePath } : {}),
          ...(uploaded.viewUrlExpiresAt ? { viewUrlExpiresAt: uploaded.viewUrlExpiresAt } : {}),
        });
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, isLimitReached, onAddReference, onUploadSidebarImage]
  );

  return (
    <div className="relative" data-testid="video-references-popover-root">
      <button
        type="button"
        data-testid="video-references-trigger"
        className={cn(
          'inline-flex h-[30px] items-center gap-[5px] rounded-lg border-none px-2.5 text-xs font-medium transition-colors',
          'bg-transparent text-[#555B6E] hover:bg-[#1C1E26] hover:text-[#E2E6EF]',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        disabled={disabled}
      >
        <span className="flex opacity-60">
          <Image size={13} />
        </span>
        References
        <span className="rounded bg-[#1A1C22] px-1.5 py-px text-[10px] text-[#8B92A5]">
          {references.length}/{maxSlots}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = '';
        }}
      />

      {isOpen ? (
        <div
          role="dialog"
          data-testid="video-references-popover"
          className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-[260px] rounded-xl border border-[#22252C] bg-[#16181E] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold tracking-[0.05em] text-[#8B92A5]">REFERENCES</span>
            <span className="text-[10px] text-[#555B6E]">
              {references.length}/{maxSlots}
            </span>
          </div>

          {references.length ? (
            <div className="space-y-1.5">
              {references.map((reference, index) => (
                <VideoReferenceRow
                  key={reference.id}
                  reference={reference}
                  index={index}
                  onRemove={onRemoveReference}
                  onUpdateType={onUpdateReferenceType}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#22252C] px-2.5 py-4 text-center text-[11px] text-[#555B6E]">
              Add reference images for style or character consistency.
            </div>
          )}

          <button
            type="button"
            className={cn(
              'mt-2 h-8 w-full rounded-lg border px-2 text-xs font-medium transition-colors',
              canUpload
                ? 'border-[#2C3037] text-[#8B92A5] hover:border-[#3A3D46] hover:text-[#E2E6EF]'
                : 'border-[#22252C] text-[#3A3E4C]'
            )}
            onClick={() => {
              if (!canUpload) return;
              inputRef.current?.click();
            }}
            disabled={!canUpload}
          >
            {isUploading
              ? 'Uploading…'
              : isLimitReached
                ? 'Reference limit reached'
                : 'Upload reference'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
