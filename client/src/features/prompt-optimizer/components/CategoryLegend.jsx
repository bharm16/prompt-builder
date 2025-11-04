import { memo } from 'react';
import { Info, X } from 'lucide-react';

/**
 * Category Legend Component
 * Displays a legend of all highlight categories with examples
 */
export const CategoryLegend = memo(({ show, onClose, hasContext }) => {
  if (!show) return null;

  const categories = [
    // Categories from Creative Brainstorm (when context is active)
    { name: 'Subject', color: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', example: 'lone astronaut, weathered soldier', source: 'brainstorm' },
    { name: 'Action', color: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.5)', example: 'walking slowly, sprinting through rain', source: 'brainstorm' },
    { name: 'Location', color: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)', example: 'abandoned station, foggy battlefield', source: 'brainstorm' },
    { name: 'Time', color: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)', example: 'golden hour, twilight, blue hour', source: 'brainstorm' },
    { name: 'Mood', color: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)', example: 'melancholic, tense, hopeful', source: 'brainstorm' },
    { name: 'Style', color: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)', example: '35mm film, documentary, noir', source: 'brainstorm' },

    // Categories from NLP extraction (always active)
    { name: 'Lighting', color: 'rgba(253, 224, 71, 0.2)', border: 'rgba(253, 224, 71, 0.6)', example: 'golden hour lighting, neon glow', source: 'nlp' },
    { name: 'Shot Framing', color: 'rgba(147, 197, 253, 0.18)', border: 'rgba(59, 130, 246, 0.45)', example: 'wide shot, low-angle shot', source: 'nlp' },
    { name: 'Camera Movement', color: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.55)', example: 'dolly in, pan left', source: 'nlp' },
    { name: 'Depth of Field', color: 'rgba(251, 146, 60, 0.18)', border: 'rgba(251, 146, 60, 0.5)', example: 'shallow depth of field, creamy bokeh', source: 'nlp' },
    { name: 'Color Palette', color: 'rgba(244, 114, 182, 0.2)', border: 'rgba(244, 114, 182, 0.55)', example: 'teal and orange, muted pastels', source: 'nlp' },
    { name: 'Environment Details', color: 'rgba(34, 197, 94, 0.18)', border: 'rgba(34, 197, 94, 0.55)', example: 'rain-soaked alley, frozen tundra', source: 'nlp' },
    { name: 'Technical Specs', color: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)', example: '35mm, 24fps, 2.39:1', source: 'nlp' },
    { name: 'Descriptive Language', color: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.4)', example: 'soft shadows, weathered hands', source: 'nlp' },
  ];

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
        {hasContext && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-700 self-start" title="Using context from Creative Brainstorm for intelligent highlighting">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Brainstorm Context Active</span>
          </div>
        )}
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
          {hasContext ? (
            <>
              <p className="text-xs font-semibold text-emerald-700 mb-2">
                Context-Aware Highlighting Active
              </p>
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
                <strong>Powered by LLM Analysis:</strong>
              </p>
              <ul className="text-xs text-neutral-500 space-y-1 ml-3">
                <li>• Intelligent semantic understanding</li>
                <li>• Context-aware categorization</li>
                <li>• Technical specification detection</li>
                <li>• Confidence-based highlighting</li>
              </ul>
            </>
          )}
          <p className="text-xs text-neutral-500 leading-relaxed mt-2">
            Click highlights to get AI-powered alternatives.
          </p>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';
