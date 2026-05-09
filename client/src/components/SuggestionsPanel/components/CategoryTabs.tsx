/**
 * CategoryTabs Component
 *
 * Category tab selector for filtering suggestions by category.
 */

import { Button } from "@promptstudio/system/components/ui/button";
import type { CategoryGroup } from "../hooks/types";

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
    <div className="border-border bg-app flex flex-shrink-0 flex-wrap gap-1 border-b px-3 py-2">
      {categories.map((cat) => (
        <Button
          key={cat.category}
          onClick={() => onCategoryChange(cat.category)}
          variant="ghost"
          className={`text-label-12 items-center gap-1 rounded-md px-2 py-1 transition-colors duration-150 ${
            activeCategory === cat.category
              ? "bg-foreground text-white"
              : "bg-app text-foreground hover:bg-surface-1 border-border hover:border-border-strong border"
          }`}
          aria-pressed={activeCategory === cat.category}
          aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
        >
          <span>{cat.category}</span>
          <span
            className={`text-label-12 rounded-md px-1 py-1 ${
              activeCategory === cat.category
                ? "bg-white/20"
                : "bg-surface-1 text-muted"
            }`}
          >
            {cat.suggestions.length}
          </span>
        </Button>
      ))}
    </div>
  );
}
