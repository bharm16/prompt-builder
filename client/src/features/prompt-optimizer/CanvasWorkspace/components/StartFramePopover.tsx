import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { cn } from '@/utils/cn';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { hasGcsSignedUrlParams } from '@/utils/storageUrl';

interface StartFramePopoverProps {
  startFrame: KeyframeTile | null;
  cameraMotion: CameraPath | null;
  onSetStartFrame: (tile: KeyframeTile) => void;
  onClearStartFrame: () => void;
  onOpenMotion: () => void;
  onStartFrameUpload?: ((file: File) => void | Promise<void>) | undefined;
  disabled?: boolean | undefined;
}

export function StartFramePopover({
  startFrame,
  cameraMotion,
  onSetStartFrame,
  onClearStartFrame,
  onOpenMotion,
  onStartFrameUpload,
  disabled = false,
}: StartFramePopoverProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const shouldResolveUrl = Boolean(
    startFrame &&
      (startFrame.storagePath || startFrame.assetId || hasGcsSignedUrlParams(startFrame.url))
  );

  const { url: resolvedPreviewUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: startFrame?.url ?? null,
    storagePath: startFrame?.storagePath ?? null,
    assetId: startFrame?.assetId ?? null,
    enabled: shouldResolveUrl,
  });

  const previewUrl = useMemo(() => {
    if (!startFrame) return null;
    return resolvedPreviewUrl || startFrame.url;
  }, [resolvedPreviewUrl, startFrame]);

  const handleUpload = useCallback(
    async (file: File): Promise<void> => {
      if (disabled) return;

      if (onStartFrameUpload) {
        const result = onStartFrameUpload(file);
        if (result && typeof (result as Promise<void>).then === 'function') {
          setIsUploading(true);
          try {
            await result;
          } finally {
            setIsUploading(false);
          }
        }
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      onSetStartFrame({
        id: `start-frame-local-${Date.now()}`,
        url: dataUrl,
        source: 'upload',
      });
    },
    [disabled, onSetStartFrame, onStartFrameUpload]
  );

  return (
    <div className="relative" data-testid="start-frame-popover-root">
      <button
        type="button"
        data-testid="start-frame-trigger"
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors',
          startFrame
            ? 'border-[#3A3D46] bg-[#16181E] text-[#E2E6EF] hover:border-[#4A4E5B]'
            : 'border-dashed border-[#22252C] bg-[#111318] text-[#8B92A5] hover:border-[#3A3D46]',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        onClick={() => {
          if (disabled) return;
          setIsOpen((previous) => !previous);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        disabled={disabled}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="h-4 w-6 rounded-[2px] object-cover"
            loading="lazy"
          />
        ) : null}
        <span>Start frame</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleUpload(file);
          }
          event.target.value = '';
        }}
      />

      {isOpen ? (
        <div
          role="dialog"
          data-testid="start-frame-popover"
          className="absolute bottom-[calc(100%+8px)] left-0 z-40 w-72 rounded-xl border border-[#22252C] bg-[#16181E] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          {previewUrl ? (
            <div className="overflow-hidden rounded-lg border border-[#22252C] bg-[#0D0E12]">
              <img
                src={previewUrl}
                alt="Start frame preview"
                className="h-36 w-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#2D3140] bg-[#0D0E12] p-4 text-center">
              <p className="text-[12px] font-semibold text-[#E2E6EF]">
                Upload a start frame
              </p>
              <p className="mt-1 text-[11px] text-[#8B92A5]">
                PNG, JPG, or WEBP
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="start-frame-upload-button"
              className="h-8 rounded-lg border border-[#22252C] bg-[#111318] px-2.5 text-[11px] font-semibold text-[#E2E6EF] transition-colors hover:border-[#3A3D46]"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              {isUploading ? 'Uploading...' : startFrame ? 'Replace' : 'Upload'}
            </button>

            {startFrame ? (
              <button
                type="button"
                data-testid="start-frame-clear-button"
                className="h-8 rounded-lg border border-[#3A2020] bg-[#221415] px-2.5 text-[11px] font-semibold text-[#FCA5A5] transition-colors hover:bg-[#2B191B]"
                onClick={() => {
                  onClearStartFrame();
                }}
              >
                Clear
              </button>
            ) : null}

            {startFrame ? (
              <button
                type="button"
                data-testid="start-frame-motion-button"
                className="h-8 rounded-lg border border-[#2F254B] bg-[#1A1530] px-2.5 text-[11px] font-semibold text-[#C4B5FD] transition-colors hover:bg-[#201A3A]"
                onClick={onOpenMotion}
              >
                {cameraMotion?.label ? `Motion: ${cameraMotion.label}` : 'Edit Motion'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
