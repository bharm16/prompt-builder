import React from 'react';
import { ArrowLeft, Image, Video } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import type { GenerationControlsTab } from '../types';

interface PanelHeaderProps {
  activeTab: GenerationControlsTab;
  onBack?: () => void;
  onSelectTab: (tab: GenerationControlsTab) => void;
}

export function PanelHeader({ activeTab, onBack, onSelectTab }: PanelHeaderProps): React.ReactElement {
  return (
    <header className="h-12 px-4 flex items-center gap-2">
      <button
        type="button"
        className="w-7 h-7 -ml-1 rounded-md flex items-center justify-center text-[#A1AFC5] hover:bg-[#1B1E23]"
        onClick={onBack}
        aria-label="Back"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onSelectTab('video')}
          className={cn(
            'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
            activeTab === 'video'
              ? 'bg-white text-[#1A1A1A] font-bold'
              : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
          )}
        >
          <Video className="w-4 h-4" />
          Video
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('image')}
          className={cn(
            'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
            activeTab === 'image'
              ? 'bg-white text-[#1A1A1A] font-bold'
              : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
          )}
        >
          <Image className="w-4 h-4" />
          Image
        </button>
      </div>
    </header>
  );
}
