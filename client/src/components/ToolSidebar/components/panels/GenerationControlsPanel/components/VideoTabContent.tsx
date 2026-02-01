import React from 'react';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile, VideoTier } from '@components/ToolSidebar/types';
import type { ImageSubTab } from '../types';
import { KeyframeSlotsRow } from '@components/ToolSidebar/components/panels/KeyframeSlotsRow';
import { CameraMotionSelector } from './CameraMotionSelector';
import { ImageSubTabToolbar } from './ImageSubTabToolbar';
import { PromptEditor } from './PromptEditor';
import { type AutocompleteState } from './PromptTriggerAutocomplete';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';
import { VideoTierToggle } from './VideoTierToggle';
import { formatCredits } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';

interface VideoTabContentProps {
  tier: VideoTier;
  onTierChange: (tier: VideoTier) => void;
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onRemoveKeyframe: (id: string) => void;
  showMotionControls: boolean;
  hasPrimaryKeyframe: boolean;
  cameraMotion: CameraPath | null;
  onOpenCameraMotion: () => void;
  prompt: string;
  onPromptChange?: ((prompt: string) => void) | undefined;
  isInputLocked: boolean;
  isOptimizing: boolean;
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onPromptInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCreateFromTrigger?: ((trigger: string) => void) | undefined;
  autocomplete: AutocompleteState;
  imageSubTab: ImageSubTab;
  onImageSubTabChange: (tab: ImageSubTab) => void;
  faceSwapMode: 'direct' | 'face-swap';
  onFaceSwapModeChange: (mode: 'direct' | 'face-swap') => void;
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
}

export function VideoTabContent({
  tier,
  onTierChange,
  keyframes,
  isUploadDisabled,
  onRequestUpload,
  onUploadFile,
  onRemoveKeyframe,
  showMotionControls,
  hasPrimaryKeyframe,
  cameraMotion,
  onOpenCameraMotion,
  prompt,
  onPromptChange,
  isInputLocked,
  isOptimizing,
  promptInputRef,
  onPromptInputChange,
  onPromptKeyDown,
  onCreateFromTrigger,
  autocomplete,
  imageSubTab,
  onImageSubTabChange,
  faceSwapMode,
  onFaceSwapModeChange,
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
}: VideoTabContentProps): React.ReactElement {
  return (
    <>
      <VideoTierToggle tier={tier} onChange={onTierChange} />

      <KeyframeSlotsRow
        keyframes={keyframes}
        isUploadDisabled={isUploadDisabled}
        onRequestUpload={onRequestUpload}
        onUploadFile={onUploadFile}
        onRemoveKeyframe={onRemoveKeyframe}
      />

      <div className="px-3">
        <div className="rounded-lg border border-[#29292D] bg-[#151720] px-3 py-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-[#A1AFC5]">
            Image-to-Video Options
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm text-white">
              <input
                type="radio"
                name="i2v-mode"
                checked={faceSwapMode === 'direct'}
                onChange={() => onFaceSwapModeChange('direct')}
              />
              <span>
                Direct Animation
                <span className="block text-xs text-[#A1AFC5]">
                  Animate the image as-is.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-white">
              <input
                type="radio"
                name="i2v-mode"
                checked={faceSwapMode === 'face-swap'}
                onChange={() => onFaceSwapModeChange('face-swap')}
              />
              <span>
                Character Face Swap + Animation
                <span className="block text-xs text-[#A1AFC5]">
                  Replace the face, then animate.
                </span>
              </span>
            </label>
          </div>

          {faceSwapMode === 'face-swap' && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#A1AFC5]">Character</label>
                <select
                  value={selectedCharacterId}
                  onChange={(event) => onFaceSwapCharacterChange(event.target.value)}
                  className="h-9 rounded-md bg-[#1E1F25] border border-[#29292D] px-2 text-sm text-white"
                >
                  <option value="">Select a character</option>
                  {faceSwapCharacterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!faceSwapCharacterOptions.length && (
                  <div className="text-xs text-[#A1AFC5]">
                    No character assets available yet.
                  </div>
                )}
              </div>

              <div className="text-xs text-[#A1AFC5]">
                Face swap: {formatCredits(faceSwapCredits)} · Video:{' '}
                {videoCredits !== null ? formatCredits(videoCredits) : '—'} · Total:{' '}
                {totalCredits !== null ? formatCredits(totalCredits) : '—'}
              </div>

              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-[#2C3037] text-[#A1AFC5] text-sm font-semibold hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onFaceSwapPreview}
                disabled={isFaceSwapPreviewDisabled}
              >
                {faceSwapPreviewReady ? 'View Face Swap Preview' : 'Preview Face Swap'}
              </button>

              {faceSwapPreviewLoading && (
                <div className="text-xs text-[#A1AFC5]">Composing face swap…</div>
              )}
              {!faceSwapPreviewLoading && faceSwapPreviewReady && (
                <div className="text-xs text-[#65D6A6]">Preview ready.</div>
              )}
              {!faceSwapPreviewLoading && faceSwapError && (
                <div className="text-xs text-[#F59E0B]">{faceSwapError}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showMotionControls && (
        <CameraMotionSelector
          hasPrimaryKeyframe={hasPrimaryKeyframe}
          cameraMotion={cameraMotion}
          onOpen={onOpenCameraMotion}
        />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        <div className="relative border border-[#29292D] rounded-lg">
          <PromptEditor
            prompt={prompt}
            onPromptChange={onPromptChange}
            isInputLocked={isInputLocked}
            isOptimizing={isOptimizing}
            promptInputRef={promptInputRef}
            onPromptInputChange={onPromptInputChange}
            onPromptKeyDown={onPromptKeyDown}
            onCreateFromTrigger={onCreateFromTrigger}
            autocomplete={autocomplete}
            placeholder="Describe your shot — what's happening, how subjects move, key details..."
            rows={6}
            containerClassName="relative"
            textareaClassName={
              'min-h-[180px] p-3 text-white text-sm leading-6 whitespace-pre-wrap outline-none resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
            }
          />
        </div>

        <ImageSubTabToolbar className="mt-3" activeTab={imageSubTab} onSelect={onImageSubTabChange} />

        <div className="mt-3 rounded-md" role="tabpanel">
          <ReferencesOnboardingCard onUpload={onRequestUpload} isUploadDisabled={isUploadDisabled} />
        </div>
      </div>
    </>
  );
}
