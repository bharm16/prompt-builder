import React from 'react';
import { Images, Palette } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { ImageSubTab } from '../types';

interface ImageSubTabSelectorProps {
  activeTab: ImageSubTab;
  onSelect: (tab: ImageSubTab) => void;
}

export function ImageSubTabSelector({ activeTab, onSelect }: ImageSubTabSelectorProps): React.ReactElement {
  return (
    <div className="flex gap-2" role="tablist" aria-orientation="horizontal">
      <button
        type="button"
        onClick={() => onSelect('references')}
        className={cn(
          'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
          'text-sm font-semibold leading-5 cursor-pointer',
          activeTab === 'references'
            ? 'bg-[#2C3037] border border-[#2C3037] text-white'
            : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
        )}
        role="tab"
        aria-selected={activeTab === 'references'}
      >
        <Images className="w-4 h-4" />
        <span className="px-0.5">References</span>
      </button>

      <button
        type="button"
        onClick={() => onSelect('styles')}
        className={cn(
          'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
          'text-sm font-semibold leading-5 cursor-pointer',
          activeTab === 'styles'
            ? 'bg-[#2C3037] border border-[#2C3037] text-white'
            : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
        )}
        role="tab"
        aria-selected={activeTab === 'styles'}
      >
        <Palette className="w-4 h-4" />
        <span className="px-0.5">Styles</span>
      </button>
    </div>
  );
}
