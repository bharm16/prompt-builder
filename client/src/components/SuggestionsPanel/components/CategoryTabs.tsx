/**
 * CategoryTabs Component
 *
 * Category tab selector for filtering suggestions by category.
 * Following VideoConceptBuilder pattern: components/TemplateSelector.tsx
 */

import type { CategoryGroup } from '../hooks/types';

interface CategoryTabsProps {
  categories?: CategoryGroup[];
  activeCategory?: string | null;
  onCategoryChange?: (category: string) => void;
}

export function CategoryTabs({
  categories = [],
  activeCategory = null,
  onCategoryChange = () => {},
}: CategoryTabsProps): React.ReactElement | null {
  if (categories.length <= 1) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex flex-wrap gap-geist-1 px-geist-3 py-geist-2 border-b border-geist-accents-2 bg-geist-background">
      {categories.map((cat) => (
        <button
          key={cat.category}
          onClick={() => onCategoryChange(cat.category)}
          className={`inline-flex items-center gap-geist-1 px-geist-2 py-geist-1 text-label-12 rounded-geist transition-colors duration-150 ${
            activeCategory === cat.category
              ? 'bg-geist-foreground text-white'
              : 'bg-geist-background text-geist-accents-7 hover:bg-geist-accents-1 border border-geist-accents-2 hover:border-geist-accents-3'
          }`}
          aria-pressed={activeCategory === cat.category}
          aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
        >
          <span>{cat.category}</span>
          <span
            className={`text-label-12 px-geist-1 py-geist-1 rounded-geist ${
              activeCategory === cat.category
                ? 'bg-white/20'
                : 'bg-geist-accents-1 text-geist-accents-6'
            }`}
          >
            {cat.suggestions.length}
          </span>
        </button>
      ))}
    </div>
  );
}

