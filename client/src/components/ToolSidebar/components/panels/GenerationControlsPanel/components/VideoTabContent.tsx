import React from "react";
import { ChevronDown } from "@promptstudio/system/components/ui";
import type { KeyframeTile } from "@components/ToolSidebar/types";
import type {
  ExtendVideoSource,
  VideoReferenceImage,
} from "@features/generation-controls";
import { StartFrameControl } from "@components/ToolSidebar/components/panels/StartFrameControl";
import { EndFrameControl } from "@components/ToolSidebar/components/panels/EndFrameControl";
import { VideoPromptToolbar } from "./VideoPromptToolbar";
import { ReferencesOnboardingCard } from "./ReferencesOnboardingCard";
import { VideoReferenceSlots } from "./VideoReferenceSlots";
import { formatCredits } from "@features/generations/config/generationConfig";

interface VideoTabContentProps {
  startFrame: KeyframeTile | null;
  endFrame: KeyframeTile | null;
  videoReferenceImages: VideoReferenceImage[];
  extendVideo: ExtendVideoSource | null;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsReferenceImages: boolean;
  supportsExtendVideo: boolean;
  maxReferenceImages: number;
  isUploadDisabled: boolean;
  isEndFrameUploadDisabled: boolean;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onClearStartFrame: () => void;
  onRequestEndFrameUpload: () => void;
  onEndFrameUpload: (file: File) => void | Promise<void>;
  onClearEndFrame: () => void;
  onRequestVideoReferenceUpload: () => void;
  onAddVideoReference: (file: File) => void | Promise<void>;
  onRemoveVideoReference: (id: string) => void;
  onUpdateVideoReferenceType: (id: string, type: "asset" | "style") => void;
  onClearExtendVideo: () => void;
  promptLength: number;
  faceSwapMode: "direct" | "face-swap";
  faceSwapCharacterOptions: Array<{ id: string; label: string }>;
  selectedCharacterId: string;
  onFaceSwapCharacterChange: (assetId: string) => void;
  onFaceSwapPreview: () => void;
  isFaceSwapPreviewDisabled: boolean;
  faceSwapPreviewReady: boolean;
  faceSwapPreviewLoading: boolean;
  faceSwapError: string | null;
  faceSwapCredits: number;
  videoCredits: number | null;
  totalCredits: number | null;
  canCopy: boolean;
  canClear: boolean;
  onCopy: () => void;
  onClear: () => void;
  canGeneratePreviews: boolean;
  onGenerateSinglePreview: () => void;
  onGenerateFourPreviews: () => void;
}

export function VideoTabContent({
  startFrame,
  endFrame,
  videoReferenceImages,
  extendVideo,
  supportsStartFrame,
  supportsEndFrame,
  supportsReferenceImages,
  supportsExtendVideo,
  maxReferenceImages,
  isUploadDisabled,
  isEndFrameUploadDisabled,
  onRequestUpload,
  onUploadFile,
  onClearStartFrame,
  onRequestEndFrameUpload,
  onEndFrameUpload,
  onClearEndFrame,
  onRequestVideoReferenceUpload,
  onAddVideoReference,
  onRemoveVideoReference,
  onUpdateVideoReferenceType,
  onClearExtendVideo,
  promptLength,
  faceSwapMode,
  faceSwapCharacterOptions,
  selectedCharacterId,
  onFaceSwapCharacterChange,
  onFaceSwapPreview,
  isFaceSwapPreviewDisabled,
  faceSwapPreviewReady,
  faceSwapPreviewLoading,
  faceSwapError,
  faceSwapCredits,
  videoCredits,
  totalCredits,
  canCopy,
  canClear,
  onCopy,
  onClear,
  canGeneratePreviews,
  onGenerateSinglePreview,
  onGenerateFourPreviews,
}: VideoTabContentProps): React.ReactElement {
  const showStartFrame = supportsStartFrame || !supportsEndFrame;
  const isVideoReferenceLimitReached =
    maxReferenceImages <= 0 ||
    videoReferenceImages.length >= maxReferenceImages;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-[14px] py-3 flex flex-col gap-2.5">
      <div className="rounded-xl border border-tool-nav-active bg-tool-surface-card overflow-hidden transition-colors focus-within:border-tool-accent-selection">
        <div className="px-3 py-3">
          <div className="flex gap-2">
            {showStartFrame && (
              <StartFrameControl
                startFrame={startFrame}
                isUploadDisabled={isUploadDisabled}
                onRequestUpload={onRequestUpload}
                onUploadFile={onUploadFile}
                onClear={onClearStartFrame}
              />
            )}
            {supportsEndFrame && (
              <EndFrameControl
                endFrame={endFrame}
                isUploadDisabled={isEndFrameUploadDisabled}
                onRequestUpload={onRequestEndFrameUpload}
                onUploadFile={onEndFrameUpload}
                onClear={onClearEndFrame}
              />
            )}
          </div>
        </div>

        <VideoPromptToolbar
          canCopy={canCopy}
          canClear={canClear}
          canGeneratePreviews={canGeneratePreviews}
          onCopy={onCopy}
          onClear={onClear}
          onGenerateSinglePreview={onGenerateSinglePreview}
          onGenerateFourPreviews={onGenerateFourPreviews}
          promptLength={promptLength}
        />
      </div>

      {faceSwapMode === "face-swap" && (
        <div className="rounded-xl border border-tool-nav-active bg-tool-surface-card px-3 py-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-tool-text-dim">
            Face Swap
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-tool-text-dim">Character</label>
            <select
              value={selectedCharacterId}
              onChange={(event) =>
                onFaceSwapCharacterChange(event.target.value)
              }
              className="h-9 rounded-md bg-tool-surface-deep border border-tool-nav-active px-2 text-sm text-white"
            >
              <option value="">Select a character</option>
              {faceSwapCharacterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {!faceSwapCharacterOptions.length && (
              <div className="text-xs text-tool-text-dim">
                No character assets available yet.
              </div>
            )}
          </div>

          <div className="text-xs text-tool-text-dim">
            Face swap: {formatCredits(faceSwapCredits)} · Video:{" "}
            {videoCredits !== null ? formatCredits(videoCredits) : "—"} · Total:{" "}
            {totalCredits !== null ? formatCredits(totalCredits) : "—"}
          </div>

          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-tool-nav-active text-tool-text-dim text-sm font-semibold hover:bg-tool-nav-active disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onFaceSwapPreview}
            disabled={isFaceSwapPreviewDisabled}
          >
            {faceSwapPreviewReady
              ? "View Face Swap Preview"
              : "Preview Face Swap"}
          </button>

          {faceSwapPreviewLoading && (
            <div className="text-xs text-tool-text-dim">
              Composing face swap…
            </div>
          )}
          {!faceSwapPreviewLoading && faceSwapPreviewReady && (
            <div className="text-xs text-success-400">Preview ready.</div>
          )}
          {!faceSwapPreviewLoading && faceSwapError && (
            <div className="text-xs text-amber-400">{faceSwapError}</div>
          )}
        </div>
      )}

      {supportsReferenceImages && (
        <div>
          <div className="flex items-center gap-2 px-0.5">
            <ChevronDown className="w-2.5 h-2.5 text-tool-text-subdued" />
            <span className="text-xs font-semibold text-tool-text-dim">
              References
            </span>
            <div className="flex-1 h-px bg-tool-nav-active mx-2" />
            <span className="text-[10px] text-tool-text-label">
              {videoReferenceImages.length} / {maxReferenceImages}
            </span>
          </div>
          <div className="mt-1 rounded-md" role="tabpanel">
            {videoReferenceImages.length === 0 ? (
              <ReferencesOnboardingCard
                onUpload={onRequestVideoReferenceUpload}
                isUploadDisabled={isVideoReferenceLimitReached}
              />
            ) : (
              <VideoReferenceSlots
                references={videoReferenceImages}
                maxSlots={maxReferenceImages}
                isUploadDisabled={isVideoReferenceLimitReached}
                onRequestUpload={onRequestVideoReferenceUpload}
                onUploadFile={onAddVideoReference}
                onRemove={onRemoveVideoReference}
                onUpdateType={onUpdateVideoReferenceType}
              />
            )}
          </div>
        </div>
      )}

      {supportsExtendVideo && extendVideo && (
        <div className="rounded-xl border border-tool-nav-active bg-tool-surface-card px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-foreground truncate">
              Extending video
            </div>
            <div className="text-[10px] text-tool-text-subdued">
              Generation will continue from this clip
            </div>
          </div>
          <button
            type="button"
            onClick={onClearExtendVideo}
            className="text-[10px] text-tool-text-dim hover:text-white"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
