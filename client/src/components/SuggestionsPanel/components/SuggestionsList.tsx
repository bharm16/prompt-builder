/**
 * SuggestionsList Component
 *
 * Renders list of suggestions with keyboard shortcuts, copy functionality, and compatibility badges.
 * Following VideoConceptBuilder pattern: components/ElementCard.tsx
 */

import { renderCompatibilityBadge, normalizeSuggestion } from '../utils/suggestionHelpers';
import { MAX_KEYBOARD_SHORTCUTS } from '../config/panelConfig';
import type { SuggestionItem } from '../hooks/types';

interface SuggestionsListProps {
  suggestions?: SuggestionItem[];
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
  isPlaceholder?: boolean;
  showCopyAction?: boolean;
}

export function SuggestionsList({
  suggestions = [],
  onSuggestionClick = () => {},
  isPlaceholder = false,
  showCopyAction = true,
}: SuggestionsListProps): React.ReactElement | null {
  if (suggestions.length === 0) {
    return null;
  }

  const handleSuggestionSelect = (suggestion: SuggestionItem): void => {
    const payload = normalizeSuggestion(suggestion);
    if (payload) {
      onSuggestionClick(payload);
    }
  };

  const handleCopy = (text: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
  };

  const handleCopyKeyDown = (text: string, e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      e.preventDefault();
      if (typeof navigator !== 'undefined' && navigator?.clipboard) {
        navigator.clipboard.writeText(text);
      }
    }
  };

  return (
    <div
      className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-100 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400"
      role="list"
      aria-label="Suggestion options"
      style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}
    >
      {suggestions.map((suggestion, index) => {
        const suggestionObj = normalizeSuggestion(suggestion) as SuggestionItem;
        const suggestionText = suggestionObj?.text || '';

        return (
          <div
            key={`${suggestionText}-${index}`}
            className="group relative animate-[slideIn_0.3s_ease-out_forwards] opacity-0"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <button
              onClick={() => handleSuggestionSelect(suggestionObj || suggestion)}
              className="w-full p-3.5 text-left rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 active:scale-[0.98]"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {index < MAX_KEYBOARD_SHORTCUTS && (
                <kbd className="absolute top-3 right-3 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {index + 1}
                </kbd>
              )}

              <div className="space-y-2 pr-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-semibold text-neutral-900 break-words leading-snug whitespace-pre-wrap">
                    {suggestionText}
                  </div>
                  {suggestionObj?.compatibility !== undefined &&
                    renderCompatibilityBadge(suggestionObj.compatibility)}
                </div>
                {isPlaceholder && suggestionObj?.explanation ? (
                  <div className="text-[11px] leading-relaxed text-neutral-600 break-words">
                    {suggestionObj.explanation}
                  </div>
                ) : suggestionObj?.explanation ? (
                  <div className="text-[11px] leading-relaxed text-neutral-600 break-words">
                    {suggestionObj.explanation}
                  </div>
                ) : null}
              </div>

              {showCopyAction && suggestionText && (
                <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <span
                    onClick={(e) => handleCopy(suggestionText, e)}
                    className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-150 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => handleCopyKeyDown(suggestionText, e)}
                  >
                    Copy
                  </span>
                  <span className="text-neutral-300">•</span>
                  <span className="text-[11px] text-neutral-500">Click to apply</span>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

