import React from 'react';
import { cn } from '@utils/cn';
import type { VideoTier } from '@components/ToolSidebar/types';

interface VideoTierToggleProps {
  tier: VideoTier;
  onChange: (tier: VideoTier) => void;
}

const VIDEO_TIERS: Array<{ value: VideoTier; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'render', label: 'Render' },
];

export function VideoTierToggle({ tier, onChange }: VideoTierToggleProps): React.ReactElement {
  return (
    <div className="px-3 pt-3 flex gap-1">
      {VIDEO_TIERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
            tier === value
              ? 'bg-white text-[#1A1A1A] font-bold'
              : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
