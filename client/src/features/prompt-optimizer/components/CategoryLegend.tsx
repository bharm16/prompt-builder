import { memo } from 'react';
import { Info, X } from 'lucide-react';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from '../SpanBentoGrid/config/bentoConfig';
import type { CategoryLegendProps } from '../types';

type CategoryKey = keyof typeof CATEGORY_CONFIG;

/**
 * Get example text for each category
 */
function getCategoryExample(category: CategoryKey): string {
  const examples: Record<CategoryKey, string> = {
    shot: 'close-up, wide shot, low-angle',
    subject: 'young painter, elderly historian',
    action: 'gripping paintbrush, walking slowly',
    environment: 'cozy studio, rain-soaked alley',
    lighting: 'soft diffused light, golden hour',
    camera: 'gently pans, dolly in, rack focus',
    style: '35mm film, cyberpunk, noir',
    technical: '4k, 8k, 16:9, shallow DOF',
    audio: 'low ambient hum, subtle score',
  };
  return examples[category] ?? '';
}

/**
 * Category Legend Component
 * Displays a legend of all highlight categories with examples
 * Now dynamically generated from bentoConfig for consistency
 */
export const CategoryLegend = memo<CategoryLegendProps>(({ show, onClose, hasContext = false, isSuggestionsOpen = false }): React.ReactElement | null => {
  if (!show) return null;

  // Generate categories dynamically from actual configuration
  const categories = (CATEGORY_ORDER as CategoryKey[]).map((categoryKey) => {
    const config = CATEGORY_CONFIG[categoryKey];
    return {
      name: config.label,
      color: config.backgroundColor,
      border: config.borderColor,
      example: getCategoryExample(categoryKey),
    };
  });

  // Dynamic positioning based on right-rail visibility (PromptCanvas-scoped vars).
  const gapVar = 'var(--pc-gap, 16px)';
  const railVar = 'var(--pc-right-rail, 420px)';
  const rightOffset = isSuggestionsOpen ? `calc(${gapVar} + ${railVar} + ${gapVar})` : gapVar;

  return (
    <div
      className="po-category-legend po-popover po-surface po-surface--grad po-animate-pop-in"
      style={{ right: rightOffset }}
      role="dialog"
      aria-label="Highlight categories"
    >
      <div className="po-category-legend__header">
        <div className="po-category-legend__header-left">
          <div className="po-category-legend__title">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Highlight categories
          </div>
          <div className="po-category-legend__subtitle">
            {hasContext ? (
              <span className="status-pill" data-status="ready">
                <span className="status-pill__dot" aria-hidden="true" />
                Brainstorm context active
              </span>
            ) : (
              'Showing all span labeling categories'
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="po-action-icon"
          aria-label="Close legend"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="po-category-legend__body">
        <div className="po-category-legend__list" role="list">
          {categories.map((cat) => (
            <div key={cat.name} className="po-category-legend__item" role="listitem">
              <div
                className="po-category-legend__swatch"
                aria-hidden="true"
                style={{ backgroundColor: cat.color, borderColor: cat.border }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="po-category-legend__item-title">{cat.name}</div>
                <div className="po-category-legend__item-example" title={cat.example}>
                  {cat.example}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="po-category-legend__footer">
          <div className="po-category-legend__footer-title">How it works</div>
          <div className="po-category-legend__footer-text">
            {hasContext
              ? 'Your Creative Brainstorm selections are prioritized first, followed by additional details detected by analysis.'
              : 'Categories are automatically detected based on video production standards.'}
          </div>
          <ul className="po-category-legend__footer-list">
            {hasContext ? (
              <>
                <li>Your input gets highest priority</li>
                <li>Semantic matches detected</li>
                <li>Additional analysis for new details</li>
                <li>Smart deduplication prevents overlaps</li>
              </>
            ) : (
              <>
                <li>Intelligent semantic understanding</li>
                <li>Context-aware categorization</li>
                <li>Aligned with video generation models</li>
                <li>Confidence-based highlighting</li>
              </>
            )}
          </ul>
          <div className="po-category-legend__footer-text" style={{ marginTop: 'var(--s-3)' }}>
            Click any highlight to get AI-powered alternatives.
          </div>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';
