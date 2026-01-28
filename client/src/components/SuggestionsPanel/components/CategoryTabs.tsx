/**
 * CategoryTabs Component
 *
 * Category tab selector for filtering suggestions by category.
 * Following VideoConceptBuilder pattern: components/TemplateSelector.tsx
 */

import { Button } from '@promptstudio/system/components/ui/button';
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
    <div className="flex-shrink-0 flex flex-wrap gap-1 px-3 py-2 border-b border-border bg-app">
      {categories.map((cat) => (
        <Button
          key={cat.category}
          onClick={() => onCategoryChange(cat.category)}
          variant="ghost"
          className={`items-center gap-1 px-2 py-1 text-label-12 rounded-md transition-colors duration-150 ${
            activeCategory === cat.category
              ? 'bg-foreground text-white'
              : 'bg-app text-foreground hover:bg-surface-1 border border-border hover:border-border-strong'
          }`}
          aria-pressed={activeCategory === cat.category}
          aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
        >
          <span>{cat.category}</span>
          <span
            className={`text-label-12 px-1 py-1 rounded-md ${
              activeCategory === cat.category
                ? 'bg-white/20'
                : 'bg-surface-1 text-muted'
            }`}
          >
            {cat.suggestions.length}
          </span>
        </Button>
      ))}
    </div>
  );
}
