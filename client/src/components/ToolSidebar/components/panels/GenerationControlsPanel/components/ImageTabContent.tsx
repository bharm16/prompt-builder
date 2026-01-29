import React from 'react';
import { ChevronDown, Copy, GraduationCap, ScanEye, Trash2 } from '@promptstudio/system/components/ui';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { ImageSubTab } from '../types';
import { ImageReferenceSlotsRow } from '../../ImageReferenceSlotsRow';
import { ImageSubTabSelector } from './ImageSubTabSelector';
import { PromptEditor } from './PromptEditor';
import { type AutocompleteState } from './PromptTriggerAutocomplete';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';

interface ImageTabContentProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onRemoveKeyframe: (id: string) => void;
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  isInputLocked: boolean;
  isOptimizing: boolean;
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onPromptInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  autocomplete: AutocompleteState;
  imageSubTab: ImageSubTab;
  onImageSubTabChange: (tab: ImageSubTab) => void;
  onBack?: () => void;
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
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden px-4 pt-3">
      <div className="flex flex-col overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 relative border border-[#29292D] rounded-lg overflow-auto">
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
              Boolean(onPromptChange) && !prompt.trim() ? (
                <span className="absolute top-3 left-3 text-base leading-6 text-[#7C839C]">
                  Describe your shot,{' '}
                  <button
                    type="button"
                    className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
                    onClick={() => {
                      onImageSubTabChange('references');
                    }}
                  >
                    add image references
                  </button>
                  , or{' '}
                  <button
                    type="button"
                    className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
                    onClick={() => {
                      // placeholder for future sketch flow
                    }}
                  >
                    sketch a scene
                  </button>
                  .{' '}
                </span>
              ) : null
            }
            footer={
              <div className="flex items-center justify-between gap-2 p-3 min-h-[40px]">
                <div className="flex items-center gap-1 flex-1">
                  <button
                    type="button"
                    aria-label="Copy text"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                    onClick={onCopy}
                    disabled={!canCopy}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Clear text"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                    onClick={onClear}
                    disabled={!canClear}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="View guide"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                    onClick={() => {
                      window.open(
                        'https://help.runwayml.com/hc/en-us/articles/40042718905875',
                        '_blank',
                        'noopener,noreferrer'
                      );
                    }}
                  >
                    <GraduationCap className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Generate prompt from image"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                    onClick={() => {
                      // placeholder for future "generate from image" flow
                    }}
                  >
                    <ScanEye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <ImageSubTabSelector activeTab={imageSubTab} onSelect={onImageSubTabChange} />

        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
          aria-label="Close Panel"
          onClick={onBack}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

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
