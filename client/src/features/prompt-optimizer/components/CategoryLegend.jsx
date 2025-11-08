import { memo } from 'react';
import { Info, X } from 'lucide-react';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from '../SpanBentoGrid/config/bentoConfig';

/**
 * Get example text for each category
 */
function getCategoryExample(category) {
  const examples = {
    subject: 'young painter, elderly historian',
    appearance: 'weathered hands, focused expression',
    wardrobe: 'worn leather jacket, fedora',
    action: 'gripping paintbrush, walking slowly',
    environment: 'cozy studio, rain-soaked alley',
    lighting: 'soft diffused light, neon glow',
    timeOfDay: 'golden hour, twilight, blue hour',
    cameraMove: 'gently pans, dolly in',
    framing: 'close-up, wide shot, low-angle',
    technical: 'shallow DOF, 24fps, 35mm film',
    descriptive: 'serene atmosphere, intimate moment',
  };
  return examples[category] || '';
}

/**
 * Category Legend Component
 * Displays a legend of all highlight categories with examples
 * Now dynamically generated from bentoConfig for consistency
 */
export const CategoryLegend = memo(({ show, onClose, hasContext }) => {
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
    <div className="fixed top-20 right-6 z-30 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg">
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Highlight Categories</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Close legend"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs text-neutral-500">
          {hasContext ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-medium text-emerald-700" title="Using context from Creative Brainstorm for intelligent highlighting">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Brainstorm Context Active</span>
            </div>
          ) : (
            <span>Showing all span labeling categories</span>
          )}
        </div>
      </div>
      <div className="p-3 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-start gap-2">
              <div
                className="flex-shrink-0 w-16 h-6 rounded border mt-0.5"
                style={{
                  backgroundColor: cat.color,
                  borderColor: cat.border,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-900">{cat.name}</div>
                <div className="text-xs text-neutral-500 truncate">{cat.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <p className="text-xs font-semibold text-neutral-700 mb-2">
            How It Works
          </p>
          {hasContext ? (
            <>
              <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                Your Creative Brainstorm selections are prioritized and highlighted first,
                followed by additional details detected by LLM analysis.
              </p>
              <ul className="text-xs text-neutral-500 space-y-1 ml-3">
                <li>• Your input gets highest priority (100% confidence)</li>
                <li>• Semantic matches detected (related terms)</li>
                <li>• Additional LLM analysis for new details</li>
                <li>• Smart deduplication prevents overlaps</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                Categories are automatically detected using LLM analysis based on video production standards.
              </p>
              <ul className="text-xs text-neutral-500 space-y-1 ml-3">
                <li>• Intelligent semantic understanding</li>
                <li>• Context-aware categorization</li>
                <li>• Aligned with video generation models</li>
                <li>• Confidence-based highlighting</li>
              </ul>
            </>
          )}
          <p className="text-xs text-neutral-500 leading-relaxed mt-2">
            Click any highlight to get AI-powered alternatives.
          </p>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';
