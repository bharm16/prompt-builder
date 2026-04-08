import React, { useCallback, useMemo, useRef, useState } from "react";
import { X, Image } from "@promptstudio/system/components/ui";
import type { CameraPath } from "@/features/convergence/types";
import type { KeyframeTile } from "@features/generation-controls";
import { cn } from "@/utils/cn";
import { useResolvedMediaUrl } from "@/hooks/useResolvedMediaUrl";
import { hasGcsSignedUrlParams } from "@/utils/storageUrl";

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
      (startFrame.storagePath ||
        startFrame.assetId ||
        hasGcsSignedUrlParams(startFrame.url)),
  );

  const { url: resolvedPreviewUrl } = useResolvedMediaUrl({
    kind: "image",
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
        if (result && typeof (result as Promise<void>).then === "function") {
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
        source: "upload",
      });
    },
    [disabled, onSetStartFrame, onStartFrameUpload],
  );

  return (
    <div className="relative" data-testid="start-frame-popover-root">
      {/* Trigger button — matches mockup BarBtn style */}
      <button
        type="button"
        data-testid="start-frame-trigger"
        className={cn(
          "inline-flex h-[28px] items-center gap-[5px] rounded-md px-2 text-xs transition-colors",
          "text-tool-text-muted hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60",
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
              className="h-[14px] w-5 flex-shrink-0 rounded-[3px] bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
            <span>Start frame</span>
            {cameraMotion?.label ? (
              <span className="text-[10px] text-tool-text-dim">
                · {cameraMotion.label}
              </span>
            ) : null}
          </>
        ) : (
          <span>Start frame</span>
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
          event.target.value = "";
        }}
      />

      {/* Popover — 220px wide, opens upward */}
      {isOpen ? (
        <div
          role="dialog"
          data-testid="start-frame-popover"
          className="absolute bottom-[calc(100%+8px)] left-0 z-[100] w-[220px] overflow-hidden rounded-xl border border-tool-nav-active bg-tool-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2"
          onClick={(e) => e.stopPropagation()}
        >
          {previewUrl ? (
            <>
              {/* Thumbnail with close button */}
              <div className="relative aspect-video bg-tool-surface-deep">
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
                <div className="mb-1.5 text-[10px] font-semibold tracking-[0.06em] text-tool-text-label">
                  CAMERA MOTION
                </div>
                <button
                  type="button"
                  data-testid="start-frame-motion-button"
                  className={cn(
                    "h-[26px] rounded-md border px-2 text-[11px] transition-colors",
                    cameraMotion
                      ? "border-tool-accent-neutral/40 bg-tool-accent-neutral/8 text-tool-accent-neutral"
                      : "border-tool-nav-active text-tool-text-dim hover:border-tool-text-disabled",
                  )}
                  onClick={onOpenMotion}
                >
                  {cameraMotion?.label ?? "Select motion…"}
                </button>
              </div>
            </>
          ) : (
            /* Empty upload state */
            <div className="p-4 text-center">
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-tool-nav-active py-5 transition-colors hover:border-tool-text-disabled"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                <span className="flex text-tool-text-label">
                  <Image size={13} />
                </span>
                <span className="text-[11px] text-tool-text-subdued">
                  {isUploading ? "Uploading…" : "Drop image or click to upload"}
                </span>
              </button>
              <span className="mt-2 block text-[10px] text-tool-text-label">
                Or select from storyboard previews
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
