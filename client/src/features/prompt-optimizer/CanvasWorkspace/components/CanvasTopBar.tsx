import React from 'react';
import { Copy, ArrowClockwise, ArrowCounterClockwise, Share } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';

interface CanvasTopBarProps {
  title: string;
  subtitle?: string | null | undefined;
  copied: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onCopy: () => void;
  onShare: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function CanvasTopBar({
  title,
  subtitle,
  copied,
  canUndo,
  canRedo,
  onCopy,
  onShare,
  onUndo,
  onRedo,
}: CanvasTopBarProps): React.ReactElement {
  return (
    <div className="flex h-12 items-center justify-between border-b border-[#1A1C22] bg-[#111318] px-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#E2E6EF]">{title}</p>
        {subtitle ? (
          <p className="truncate text-[11px] text-[#8B92A5]">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 border border-[#22252C] bg-[#16181E] text-[#8B92A5] hover:bg-[#1B1E23] hover:text-[#E2E6EF]"
          onClick={onCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy prompt'}
          title={copied ? 'Copied' : 'Copy'}
        >
          <Copy size={13} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 border border-[#22252C] bg-[#16181E] text-[#8B92A5] hover:bg-[#1B1E23] hover:text-[#E2E6EF]"
          onClick={onShare}
          aria-label="Share prompt"
          title="Share"
        >
          <Share size={13} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 border border-[#22252C] bg-[#16181E] text-[#8B92A5] hover:bg-[#1B1E23] hover:text-[#E2E6EF]"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <ArrowCounterClockwise size={13} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 border border-[#22252C] bg-[#16181E] text-[#8B92A5] hover:bg-[#1B1E23] hover:text-[#E2E6EF]"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <ArrowClockwise size={13} />
        </Button>
      </div>
    </div>
  );
}
