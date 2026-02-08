import React from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { ImageSubTab } from '../types';
import { ImageReferenceSlotsRow } from '@components/ToolSidebar/components/panels/ImageReferenceSlotsRow';
import { ImagePromptFooterActions } from './ImagePromptFooterActions';
import { ImagePromptOverlay } from './ImagePromptOverlay';
import { ImageSubTabToolbar } from './ImageSubTabToolbar';
import { PromptEditor } from './PromptEditor';
import { type AutocompleteState } from './PromptTriggerAutocomplete';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';

interface ImageTabContentProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
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
  imageSubTab: ImageSubTab;
  onImageSubTabChange: (tab: ImageSubTab) => void;
  onBack?: (() => void) | undefined;
  onCopy: () => void;
  onClear: () => void;
  canCopy: boolean;
  canClear: boolean;
  footer: React.ReactNode;
}

export function ImageTabContent({
  keyframes,
  isUploadDisabled,
  onRequestUpload,
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
  imageSubTab,
  onImageSubTabChange,
  onBack,
  onCopy,
  onClear,
  canCopy,
  canClear,
  footer,
}: ImageTabContentProps): React.ReactElement {
  const showPromptOverlay = Boolean(onPromptChange) && !prompt.trim();

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden px-4 pt-3">
      <div className="flex flex-col overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 relative border border-[#29292D] rounded-lg overflow-auto">
          {promptLabel && (
            <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#A1AFC5]">
              {promptLabel}
            </div>
          )}
          <ImageReferenceSlotsRow
            keyframes={keyframes}
            isUploadDisabled={isUploadDisabled}
            onRequestUpload={onRequestUpload}
            onRemoveKeyframe={onRemoveKeyframe}
          />

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
            rows={6}
            spellCheck
            containerClassName="relative flex flex-col min-h-[128px] rounded-lg overflow-hidden"
            textareaClassName="flex-1 p-3 bg-transparent text-white text-base leading-6 overflow-y-auto whitespace-pre-wrap break-words outline-none resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            overlay={
              <ImagePromptOverlay
                isVisible={showPromptOverlay}
                onAddReferences={() => onImageSubTabChange('references')}
                onSketch={() => {
                  // placeholder for future sketch flow
                }}
              />
            }
            footer={
              <ImagePromptFooterActions
                onCopy={onCopy}
                onClear={onClear}
                canCopy={canCopy}
                canClear={canClear}
                onViewGuide={() => {
                  window.open(
                    'https://help.runwayml.com/hc/en-us/articles/40042718905875',
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                onGenerateFromImage={() => {
                  // placeholder for future "generate from image" flow
                }}
              />
            }
          />
        </div>
      </div>

      <ImageSubTabToolbar
        activeTab={imageSubTab}
        onSelect={onImageSubTabChange}
        onClose={onBack}
      />

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col" role="tabpanel">
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="rounded-md h-full">
            <div className="relative flex flex-col flex-1 min-h-0 rounded-md overflow-hidden h-full">
              <ReferencesOnboardingCard onUpload={onRequestUpload} isUploadDisabled={isUploadDisabled} />
            </div>
          </div>
        </div>

        {footer}
      </div>
    </div>
  );
}
