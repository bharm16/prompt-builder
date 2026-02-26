import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { ImageSubTab } from '../types';
import { ImageSubTabSelector } from './ImageSubTabSelector';

interface ImageSubTabToolbarProps {
  activeTab: ImageSubTab;
  onSelect: (tab: ImageSubTab) => void;
  onClose?: (() => void) | undefined;
  className?: string;
}

export function ImageSubTabToolbar({
  activeTab,
  onSelect,
  onClose,
  className,
}: ImageSubTabToolbarProps): React.ReactElement {
  const showCloseButton = typeof onClose === 'function';

  return (
    <div className={cn('flex items-center', showCloseButton ? 'justify-between' : 'justify-start', className)}>
      <ImageSubTabSelector activeTab={activeTab} onSelect={onSelect} />

      {showCloseButton && (
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
          aria-label="Close Panel"
          onClick={onClose}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
