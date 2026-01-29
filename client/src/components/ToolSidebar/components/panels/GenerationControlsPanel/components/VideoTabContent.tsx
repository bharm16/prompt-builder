import React from 'react';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile, VideoTier } from '@components/ToolSidebar/types';
import type { ImageSubTab } from '../types';
import { KeyframeSlotsRow } from '../../KeyframeSlotsRow';
import { CameraMotionSelector } from './CameraMotionSelector';
import { ImageSubTabSelector } from './ImageSubTabSelector';
import { PromptEditor } from './PromptEditor';
import { type AutocompleteState } from './PromptTriggerAutocomplete';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';
import { VideoTierToggle } from './VideoTierToggle';

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

        <div className="mt-3 flex items-center justify-between">
          <ImageSubTabSelector activeTab={imageSubTab} onSelect={onImageSubTabChange} />
        </div>

        <div className="mt-3 rounded-md" role="tabpanel">
          <ReferencesOnboardingCard onUpload={onRequestUpload} isUploadDisabled={isUploadDisabled} />
        </div>
      </div>
    </>
  );
}
