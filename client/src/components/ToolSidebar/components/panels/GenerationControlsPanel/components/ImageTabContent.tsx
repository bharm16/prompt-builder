import React from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { ImageSubTab } from '../types';
import { ImageReferenceSlotsRow } from '@components/ToolSidebar/components/panels/ImageReferenceSlotsRow';
import { ImageSubTabToolbar } from './ImageSubTabToolbar';
import { ReferencesOnboardingCard } from './ReferencesOnboardingCard';

interface ImageTabContentProps {
  keyframes: KeyframeTile[];
  isUploadDisabled: boolean;
  onRequestUpload: () => void;
  onRemoveKeyframe: (id: string) => void;
  imageSubTab: ImageSubTab;
  onImageSubTabChange: (tab: ImageSubTab) => void;
  onBack?: (() => void) | undefined;
  footer: React.ReactNode;
}

export function ImageTabContent({
  keyframes,
  isUploadDisabled,
  onRequestUpload,
  onRemoveKeyframe,
  imageSubTab,
  onImageSubTabChange,
  onBack,
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
