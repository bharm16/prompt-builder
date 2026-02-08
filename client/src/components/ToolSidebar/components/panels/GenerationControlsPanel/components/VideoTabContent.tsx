import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { KeyframeSlotsRow } from '@components/ToolSidebar/components/panels/KeyframeSlotsRow';
import { PromptEditor } from './PromptEditor';
import { VideoPromptToolbar } from './VideoPromptToolbar';
import { type AutocompleteState } from './PromptTriggerAutocomplete';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';
import { formatCredits } from '@/features/prompt-optimizer/GenerationsPanel/config/generationConfig';

interface VideoTabContentProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onUploadFile: (file: File) => void | Promise<void>;
  onRemoveKeyframe: (id: string) => void;
  prompt: string;
  onPromptChange?: ((prompt: string) => void) | undefined;
  promptLabel?: string;
  isInputLocked: boolean;
  isOptimizing: boolean;
  promptInputRef: React.RefObject<HTMLTextAreaElement>;
  onPromptInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCreateFromTrigger?: ((trigger: string) => void) | undefined;
  autocomplete: AutocompleteState;
  afterPrompt?: React.ReactNode;
  faceSwapMode: 'direct' | 'face-swap';
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
  keyframes,
  isUploadDisabled,
  onRequestUpload,
  onUploadFile,
  onRemoveKeyframe,
  prompt,
  onPromptChange,
  promptLabel,
  isInputLocked,
  isOptimizing,
  promptInputRef,
  onPromptInputChange,
  onPromptKeyDown,
  onCreateFromTrigger,
  autocomplete,
  afterPrompt,
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
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-[14px] py-3 flex flex-col gap-2.5">
      {/* ── Prompt card ── */}
      <div className="rounded-xl border border-[#22252C] bg-[#16181E] overflow-hidden transition-colors focus-within:border-[#6C5CE7]">
        <div className="px-3 pt-3">
          <KeyframeSlotsRow
            keyframes={keyframes}
            isUploadDisabled={isUploadDisabled}
            onRequestUpload={onRequestUpload}
            onUploadFile={onUploadFile}
            onRemoveKeyframe={onRemoveKeyframe}
          />
        </div>

        <div className="px-3 pt-2.5">
          <div className="relative rounded-xl">
            {promptLabel && (
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#8B92A5]">
                {promptLabel}
              </div>
            )}
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
              placeholder="Describe your shot..."
              rows={6}
              containerClassName="relative"
              textareaClassName={
                'min-h-[130px] p-0 text-[#E2E6EF] text-[13px] leading-[1.65] whitespace-pre-wrap outline-none resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0'
              }
            />
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
          promptLength={prompt.length}
        />
      </div>

      {/* ── Face swap card (conditional) ── */}
      {faceSwapMode === 'face-swap' && (
        <div className="rounded-xl border border-[#22252C] bg-[#16181E] px-3 py-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-[#8B92A5]">Face Swap</div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[#8B92A5]">Character</label>
            <select
              value={selectedCharacterId}
              onChange={(event) => onFaceSwapCharacterChange(event.target.value)}
              className="h-9 rounded-md bg-[#0D0E12] border border-[#22252C] px-2 text-sm text-white"
            >
              <option value="">Select a character</option>
              {faceSwapCharacterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {!faceSwapCharacterOptions.length && (
              <div className="text-xs text-[#8B92A5]">
                No character assets available yet.
              </div>
            )}
          </div>

          <div className="text-xs text-[#8B92A5]">
            Face swap: {formatCredits(faceSwapCredits)} · Video:{' '}
            {videoCredits !== null ? formatCredits(videoCredits) : '—'} · Total:{' '}
            {totalCredits !== null ? formatCredits(totalCredits) : '—'}
          </div>

          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[#22252C] text-[#8B92A5] text-sm font-semibold hover:bg-[#22252C] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onFaceSwapPreview}
            disabled={isFaceSwapPreviewDisabled}
          >
            {faceSwapPreviewReady ? 'View Face Swap Preview' : 'Preview Face Swap'}
          </button>

          {faceSwapPreviewLoading && (
            <div className="text-xs text-[#8B92A5]">Composing face swap…</div>
          )}
          {!faceSwapPreviewLoading && faceSwapPreviewReady && (
            <div className="text-xs text-[#4ADE80]">Preview ready.</div>
          )}
          {!faceSwapPreviewLoading && faceSwapError && (
            <div className="text-xs text-[#FBBF24]">{faceSwapError}</div>
          )}
        </div>
      )}

      {afterPrompt && <div>{afterPrompt}</div>}

      {/* ── References section ── */}
      <div>
        <div className="flex items-center gap-2 px-0.5">
          <ChevronDown className="w-2.5 h-2.5 text-[#555B6E]" />
          <span className="text-xs font-semibold text-[#8B92A5]">References</span>
          <div className="flex-1 h-px bg-[#22252C] mx-2" />
          <span className="text-[10px] text-[#3A3E4C]">0 images</span>
        </div>
        <div className="mt-1 rounded-md" role="tabpanel">
          <ReferencesOnboardingCard onUpload={onRequestUpload} isUploadDisabled={isUploadDisabled} />
        </div>
      </div>
    </div>
  );
}
