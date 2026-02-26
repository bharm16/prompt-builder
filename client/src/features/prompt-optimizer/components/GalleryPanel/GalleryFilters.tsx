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
    <div className="pointer-events-auto mb-2 flex w-[52px] flex-wrap items-center justify-center gap-1">
      {FILTERS.map((filter) => {
        const isActive = activeFilter === filter.id;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={`inline-flex h-5 min-w-[22px] items-center justify-center rounded-md px-1.5 text-[10px] font-medium transition-colors ${
              isActive
                ? 'bg-[#262626] text-[#F5F5F5]'
                : 'bg-transparent text-[#737373] hover:bg-[#171717] hover:text-[#D4D4D4]'
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

