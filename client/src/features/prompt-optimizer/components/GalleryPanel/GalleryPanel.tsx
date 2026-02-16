import React, { useMemo, useState } from 'react';
import { X } from '@promptstudio/system/components/ui';
import { GalleryFilters } from './GalleryFilters';
import { GalleryThumbnail } from './GalleryThumbnail';
import type { GalleryFilter, GalleryPanelProps } from './types';

const applyFilter = (
  filter: GalleryFilter,
  generation: GalleryPanelProps['generations'][number]
): boolean => {
  if (filter === 'preview') return generation.tier === 'preview';
  if (filter === 'draft') return generation.tier === 'draft';
  if (filter === 'favorites') return generation.isFavorite;
  return true;
};

export function GalleryPanel({
  generations,
  activeGenerationId,
  onSelectGeneration,
  onClose,
}: GalleryPanelProps): React.ReactElement {
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('all');

  const filteredGenerations = useMemo(
    () => generations.filter((generation) => applyFilter(activeFilter, generation)),
    [activeFilter, generations]
  );

  return (
    <aside
      className="flex h-full w-[200px] flex-none flex-col border-l border-[#1A1C22] bg-[#111318]"
      aria-label="Generations gallery"
      data-testid="gallery-panel"
    >
      <div className="flex h-12 items-center border-b border-[#1A1C22] px-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#E2E6EF]">Generations</span>
          <span className="text-[10px] text-[#3A3E4C]">
            {generations.length}
          </span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#555B6E] transition-colors hover:text-[#8B92A5]"
          aria-label="Close gallery"
        >
          <X size={14} weight="bold" aria-hidden="true" />
        </button>
      </div>

      <GalleryFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      <div className="flex flex-1 flex-col gap-1.5 overflow-auto px-2 pb-2 pt-1.5">
        {filteredGenerations.map((generation) => (
          <GalleryThumbnail
            key={generation.id}
            generation={generation}
            isActive={generation.id === activeGenerationId}
            onClick={() => onSelectGeneration(generation.id)}
          />
        ))}
      </div>
    </aside>
  );
}

