/**
 * CategoryTabs Component
 *
 * Category tab selector for filtering suggestions by category.
 * Following VideoConceptBuilder pattern: components/TemplateSelector.jsx (31 lines)
 */

export function CategoryTabs({ categories = [], activeCategory = null, onCategoryChange = () => {} }) {
  if (categories.length <= 1) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex flex-wrap gap-2 p-4 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white">
      {categories.map((cat) => (
        <button
          key={cat.category}
          onClick={() => onCategoryChange(cat.category)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-150 ${
            activeCategory === cat.category
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400'
          }`}
          aria-pressed={activeCategory === cat.category}
          aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
        >
          <span>{cat.category}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              activeCategory === cat.category
                ? 'bg-white/20'
                : 'bg-neutral-200 text-neutral-600'
            }`}
          >
            {cat.suggestions.length}
          </span>
        </button>
      ))}
    </div>
  );
}
