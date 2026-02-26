import React from 'react';
import { Copy, GraduationCap, ScanEye, Trash2 } from '@promptstudio/system/components/ui';

interface ImagePromptFooterActionsProps {
  onCopy: () => void;
  onClear: () => void;
  canCopy: boolean;
  canClear: boolean;
  onViewGuide: () => void;
  onGenerateFromImage?: () => void;
}

export function ImagePromptFooterActions({
  onCopy,
  onClear,
  canCopy,
  canClear,
  onViewGuide,
  onGenerateFromImage,
}: ImagePromptFooterActionsProps): React.ReactElement {
  return (
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
          onClick={onViewGuide}
        >
          <GraduationCap className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Generate prompt from image"
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onGenerateFromImage}
          disabled={!onGenerateFromImage}
        >
          <ScanEye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
