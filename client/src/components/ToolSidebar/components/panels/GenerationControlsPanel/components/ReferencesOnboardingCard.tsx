import React from 'react';
import { Folder, Upload } from '@promptstudio/system/components/ui';

interface ReferencesOnboardingCardProps {
  onUpload: () => void;
  isUploadDisabled: boolean;
}

/**
 * Empty-state card for the References section, matching v5 mockup:
 * Compact layout with stacked preview thumbnails, title, subtitle, and action buttons.
 */
export function ReferencesOnboardingCard({
  onUpload,
  isUploadDisabled,
}: ReferencesOnboardingCardProps): React.ReactElement {
  return (
    <div className="rounded-[10px] border border-[#22252C] bg-[#16181E] p-5 text-center">
      {/* Stacked preview thumbnails */}
      <div className="flex justify-center mb-3">
        {[
          { bg: 'linear-gradient(135deg, #2a1a3a, #1a0a2a)', w: 52, h: 40, rot: -8 },
          { bg: 'linear-gradient(135deg, #1a3a2a, #0a2a1a)', w: 56, h: 42, rot: 0 },
          { bg: 'linear-gradient(135deg, #3a2a1a, #2a1a0a)', w: 48, h: 38, rot: 8 },
        ].map((card, i) => (
          <div
            key={i}
            className="rounded-md border border-[#22252C]"
            style={{
              width: card.w,
              height: card.h,
              background: card.bg,
              transform: `rotate(${card.rot}deg)`,
              marginLeft: i > 0 ? -10 : 0,
            }}
          />
        ))}
      </div>

      <div className="text-xs font-semibold text-[#E2E6EF] mb-1">Create consistent scenes</div>
      <div className="text-[11px] text-[#555B6E] leading-snug max-w-[260px] mx-auto mb-3.5">
        Use 1–3 character or location images to build your scene.
      </div>

      <div className="flex justify-center gap-1.5">
        <button
          type="button"
          className="h-8 px-3.5 rounded-lg border border-[#22252C] bg-transparent text-[#8B92A5] text-xs font-medium flex items-center gap-1.5 hover:border-[#3A3D46] hover:text-[#E2E6EF] transition-colors"
        >
          <Folder className="w-[13px] h-[13px]" />
          Assets
        </button>
        <button
          type="button"
          onClick={onUpload}
          disabled={isUploadDisabled}
          className="h-8 px-3.5 rounded-lg border border-[#22252C] bg-[#16181E] text-[#8B92A5] text-xs font-medium flex items-center gap-1.5 hover:border-[#3A3D46] hover:text-[#E2E6EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-[13px] h-[13px]" />
          Upload
        </button>
      </div>
    </div>
  );
}
