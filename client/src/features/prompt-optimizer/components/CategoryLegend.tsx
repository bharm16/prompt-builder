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
    subject: 'young painter, elderly historian',
    appearance: 'weathered hands, focused expression',
    wardrobe: 'worn leather jacket, fedora',
    movement: 'gripping paintbrush, walking slowly',
    environment: 'cozy studio, rain-soaked alley',
    lighting: 'soft diffused light, golden hour',
    camera: 'gently pans, dolly in, rack focus',
    framing: 'close-up, wide shot, low-angle',
    specs: '4k, 8k, 16:9, shallow DOF',
    style: '35mm film, cyberpunk, noir',
    quality: 'masterpiece, highly detailed',
  };
  return examples[category] ?? '';
}

/**
 * Category Legend Component
 * Displays a legend of all highlight categories with examples
 * Now dynamically generated from bentoConfig for consistency
 */
export const CategoryLegend = memo<CategoryLegendProps>(({ show, onClose, hasContext = false }): React.ReactElement | null => {
  if (!show) return null;

  // Generate categories dynamically from actual configuration
  const categories = CATEGORY_ORDER.map(categoryKey => {
    const config = CATEGORY_CONFIG[categoryKey];
    return {
      name: config.label,
      color: config.color,
      border: config.borderColor,
      example: getCategoryExample(categoryKey),
    };
  });

  return (
    <div className="fixed top-12 right-geist-4 z-30 w-72 glass-card rounded-geist-lg">
      <div className="flex flex-col gap-geist-2 px-geist-3 py-geist-2 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-geist-2">
            <Info className="h-3.5 w-3.5 text-geist-accents-5" />
            <h3 className="text-label-12 text-geist-foreground">Highlight Categories</h3>
          </div>
          <button
            onClick={onClose}
            className="text-geist-accents-4 hover:text-geist-accents-6 transition-colors"
            aria-label="Close legend"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="text-label-12 text-geist-accents-5">
          {hasContext ? (
            <div className="inline-flex items-center gap-geist-1 px-geist-2 py-geist-1 bg-emerald-50 border border-emerald-200 rounded-geist text-label-12 text-emerald-700" title="Using context from Creative Brainstorm for intelligent highlighting">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Brainstorm Context Active</span>
            </div>
          ) : (
            <span>Showing all span labeling categories</span>
          )}
        </div>
      </div>
      <div className="p-geist-3 max-h-80 overflow-y-auto scrollbar-auto-hide">
        <div className="space-y-geist-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-start gap-geist-2">
              <div
                className="flex-shrink-0 w-14 h-5 rounded-geist border mt-0.5"
                style={{
                  backgroundColor: cat.color,
                  borderColor: cat.border,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-label-12 text-geist-foreground">{cat.name}</div>
                <div className="text-label-12 text-geist-accents-5 truncate">{cat.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-geist-2 pt-geist-2 border-t border-geist-accents-2">
          <p className="text-label-12 text-geist-accents-7 mb-geist-2">
            How It Works
          </p>
          {hasContext ? (
            <>
              <p className="text-label-12 text-geist-accents-5 leading-relaxed mb-geist-2">
                Your Creative Brainstorm selections are prioritized and highlighted first,
                followed by additional details detected by LLM analysis.
              </p>
              <ul className="text-label-12 text-geist-accents-5 space-y-geist-1 ml-geist-3">
                <li>• Your input gets highest priority (100% confidence)</li>
                <li>• Semantic matches detected (related terms)</li>
                <li>• Additional LLM analysis for new details</li>
                <li>• Smart deduplication prevents overlaps</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-[10px] text-neutral-500 leading-relaxed mb-1.5">
                Categories are automatically detected using LLM analysis based on video production standards.
              </p>
              <ul className="text-label-12 text-geist-accents-5 space-y-geist-1 ml-geist-3">
                <li>• Intelligent semantic understanding</li>
                <li>• Context-aware categorization</li>
                <li>• Aligned with video generation models</li>
                <li>• Confidence-based highlighting</li>
              </ul>
            </>
          )}
          <p className="text-label-12 text-geist-accents-5 leading-relaxed mt-geist-2">
            Click any highlight to get AI-powered alternatives.
          </p>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';

