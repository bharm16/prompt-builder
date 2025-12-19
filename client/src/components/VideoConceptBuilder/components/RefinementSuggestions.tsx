/**
 * Refinement Suggestions Component
 *
 * Displays AI-generated refinement suggestions for existing elements.
 */

import { Lightbulb, Loader2 } from 'lucide-react';
import { formatLabel } from '../utils/formatting';
import type { ElementKey } from '../hooks/types';
import type { ElementConfig } from './types';

interface RefinementSuggestionsProps {
  refinements: Record<string, string[]>;
  isLoading: boolean;
  elementConfig: Record<string, ElementConfig>;
  onApplyRefinement: (key: ElementKey, option: string) => void;
}

export function RefinementSuggestions({
  refinements,
  isLoading,
  elementConfig,
  onApplyRefinement,
}: RefinementSuggestionsProps): React.ReactElement | null {
  const hasRefinements = Object.entries(refinements || {}).some(
    ([, list]) => Array.isArray(list) && list.length > 0
  );

  if (!isLoading && !hasRefinements) return null;

  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-neutral-900">
            AI Refinement Suggestions
          </h3>
        </div>
        {isLoading && (
          <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
        )}
      </div>

      {hasRefinements ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.entries(refinements)
            .filter(([, options]) => Array.isArray(options) && options.length > 0)
            .map(([key, options]) => (
              <div
                key={key}
                className="p-4 rounded-lg border border-neutral-200 bg-neutral-50"
              >
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {elementConfig[key]?.label || formatLabel(key)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(options as string[]).map((option, idx) => (
                    <button
                      key={`${key}-${idx}`}
                      onClick={() => onApplyRefinement(key as ElementKey, option)}
                      className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:bg-neutral-100 transition-all duration-150"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        !isLoading && (
          <p className="mt-3 text-sm text-neutral-600">
            Add more detail to unlock tailored refinements.
          </p>
        )
      )}
    </div>
  );
}

