import React from 'react';
import type { PopoverThumbnailRailProps } from './types';

export function PopoverThumbnailRail({
  generations,
  activeId,
  onChange,
}: PopoverThumbnailRailProps): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-2 overflow-auto px-3 pb-3 pt-3.5">
      {generations.map((generation) => {
        const isSelected = generation.id === activeId;
        return (
          <button
            key={generation.id}
            type="button"
            onClick={() => onChange(generation.id)}
            className={`relative h-[70px] w-full flex-shrink-0 overflow-hidden rounded-[14px] border-[2.5px] transition-opacity ${
              isSelected
                ? 'border-[#6C5CE7] opacity-100'
                : 'border-transparent opacity-50 hover:opacity-80'
            }`}
            aria-label="Change active generation"
            data-testid={`popover-rail-${generation.id}`}
          >
            {generation.thumbnailUrl ? (
              <img
                src={generation.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1A1C22] to-[#0D0E12]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

