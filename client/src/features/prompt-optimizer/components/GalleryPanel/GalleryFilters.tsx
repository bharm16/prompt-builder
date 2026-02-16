import React from 'react';
import type { GalleryFilter } from './types';

interface GalleryFiltersProps {
  activeFilter: GalleryFilter;
  onFilterChange: (filter: GalleryFilter) => void;
}

const FILTERS: Array<{ id: GalleryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'preview', label: 'Preview' },
  { id: 'draft', label: 'Draft' },
  { id: 'favorites', label: '★' },
];

export function GalleryFilters({
  activeFilter,
  onFilterChange,
}: GalleryFiltersProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1 px-3 pb-1 pt-2">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors ${
              isActive
                ? 'bg-[#16181E] text-[#E2E6EF]'
                : 'bg-transparent text-[#555B6E] hover:text-[#8B92A5]'
            }`}
            aria-pressed={isActive}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

