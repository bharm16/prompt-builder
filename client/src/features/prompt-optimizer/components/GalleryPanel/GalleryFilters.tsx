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
                ? 'bg-neutral-800 text-foreground'
                : 'bg-transparent text-tool-text-subdued hover:bg-tool-surface-deep hover:text-muted'
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

