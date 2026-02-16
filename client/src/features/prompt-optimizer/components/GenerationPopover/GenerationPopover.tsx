import React, { useMemo } from 'react';
import { PopoverDetail } from './PopoverDetail';
import { PopoverPreview } from './PopoverPreview';
import type { GenerationPopoverProps } from './types';

export function GenerationPopover({
  generations,
  activeId,
  onChange,
  onClose,
  onReuse,
  onToggleFavorite,
}: GenerationPopoverProps): React.ReactElement | null {
  const activeGeneration = useMemo(
    () =>
      generations.find((generation) => generation.id === activeId) ??
      generations[0] ??
      null,
    [activeId, generations]
  );

  if (!activeGeneration) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-[rgba(2,2,4,0.92)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="generation-popover"
    >
      <div
        className="flex h-full w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <PopoverPreview
          generation={activeGeneration}
          onBack={onClose}
          onToggleFavorite={() =>
            onToggleFavorite(activeGeneration.id, !activeGeneration.isFavorite)
          }
        />
        <PopoverDetail
          generation={activeGeneration}
          generations={generations}
          activeId={activeGeneration.id}
          onChange={onChange}
          onReuse={() => onReuse(activeGeneration.id)}
          onCopyPrompt={() => {
            // no-op hook for analytics when needed
          }}
        />
      </div>
    </div>
  );
}

