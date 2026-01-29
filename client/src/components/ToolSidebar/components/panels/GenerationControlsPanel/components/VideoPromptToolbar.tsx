import React from 'react';
import { BookOpen, Copy, Trash2, Wand2 } from '@promptstudio/system/components/ui';

interface VideoPromptToolbarProps {
  canCopy: boolean;
  canClear: boolean;
  onCopy: () => void;
  onClear: () => void;
}

export function VideoPromptToolbar({
  canCopy,
  canClear,
  onCopy,
  onClear,
}: VideoPromptToolbarProps): React.ReactElement {
  return (
    <div className="h-12 flex items-center justify-between px-3 py-3 min-h-[40px] gap-2">
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
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23] opacity-60 cursor-not-allowed"
          disabled
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Generate prompt"
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23] opacity-60 cursor-not-allowed"
          disabled
        >
          <Wand2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
