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
    <div className="flex-shrink-0 flex flex-wrap gap-geist-2 p-geist-4 border-b border-geist-accents-2 bg-gradient-to-b from-geist-accents-1/50 to-geist-background">
      {categories.map((cat) => (
        <button
          key={cat.category}
          onClick={() => onCategoryChange(cat.category)}
          className={`inline-flex items-center gap-geist-2 px-geist-2 py-geist-1 text-label-12 rounded-geist-lg transition-all duration-150 ${
            activeCategory === cat.category
              ? 'bg-geist-foreground text-white shadow-geist-small'
              : 'bg-geist-background text-geist-accents-7 hover:bg-geist-accents-1 border border-geist-accents-3 hover:border-geist-accents-4'
          }`}
          aria-pressed={activeCategory === cat.category}
          aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
        >
          <span>{cat.category}</span>
          <span
            className={`text-label-12 px-geist-2 py-geist-1 rounded-full ${
              activeCategory === cat.category
                ? 'bg-white/20'
                : 'bg-geist-accents-2 text-geist-accents-6'
            }`}
          >
            {cat.suggestions.length}
          </span>
        </button>
      ))}
    </div>
  );
}

