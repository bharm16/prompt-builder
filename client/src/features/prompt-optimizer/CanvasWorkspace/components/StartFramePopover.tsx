import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X, Image } from '@promptstudio/system/components/ui';
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
      {/* Trigger button — matches mockup BarBtn style */}
      <button
        type="button"
        data-testid="start-frame-trigger"
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
        {previewUrl ? (
          <>
            <div
              className="h-[14px] w-5 flex-shrink-0 rounded-[3px] border border-[#22252C] bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
            <span className="text-xs text-[#E2E6EF]">Start frame</span>
            {cameraMotion?.label ? (
              <span className="rounded bg-[#6C5CE711] px-[5px] py-px text-[10px] font-semibold text-[#6C5CE7]">
                {cameraMotion.label}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span className="flex opacity-60">
              <Image size={13} />
            </span>
            Start frame
          </>
        )}
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

      {/* Popover — 220px wide, opens upward */}
      {isOpen ? (
        <div
          role="dialog"
          data-testid="start-frame-popover"
          className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-[220px] overflow-hidden rounded-xl border border-[#22252C] bg-[#16181E] shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2"
          onClick={(e) => e.stopPropagation()}
        >
          {previewUrl ? (
            <>
              {/* Thumbnail with close button */}
              <div className="relative aspect-video bg-[#0D0E12]">
                <img
                  src={previewUrl}
                  alt="Start frame"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  data-testid="start-frame-clear-button"
                  className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-black/50 text-white/60 transition-colors hover:text-white/90"
                  onClick={() => onClearStartFrame()}
                >
                  <X size={10} />
                </button>
              </div>

              {/* Camera motion pills */}
              <div className="px-2.5 py-2">
                <div className="mb-1.5 text-[10px] font-semibold tracking-[0.06em] text-[#3A3E4C]">
                  CAMERA MOTION
                </div>
                <button
                  type="button"
                  data-testid="start-frame-motion-button"
                  className={cn(
                    'h-[26px] rounded-md border px-2 text-[11px] transition-colors',
                    cameraMotion
                      ? 'border-[#6C5CE766] bg-[#6C5CE715] text-[#6C5CE7]'
                      : 'border-[#22252C] text-[#8B92A5] hover:border-[#3A3D46]'
                  )}
                  onClick={onOpenMotion}
                >
                  {cameraMotion?.label ?? 'Select motion…'}
                </button>
              </div>
            </>
          ) : (
            /* Empty upload state */
            <div className="p-4 text-center">
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-[#22252C] py-5 transition-colors hover:border-[#3A3D46]"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                <span className="flex text-[#3A3E4C]">
                  <Image size={13} />
                </span>
                <span className="text-[11px] text-[#555B6E]">
                  {isUploading ? 'Uploading…' : 'Drop image or click to upload'}
                </span>
              </button>
              <span className="mt-2 block text-[10px] text-[#3A3E4C]">
                Or select from storyboard previews
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
