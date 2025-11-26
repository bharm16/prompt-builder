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
      className="flex-1 min-h-0 space-y-geist-2 overflow-y-auto px-geist-3 py-geist-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-track]:bg-geist-accents-1 hover:[&::-webkit-scrollbar-thumb]:bg-geist-accents-3 hover:[&::-webkit-scrollbar-thumb:hover]:bg-geist-accents-4"
      role="list"
      aria-label="Suggestion options"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.scrollbarColor = 'var(--geist-accents-3) var(--geist-accents-1)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.scrollbarColor = 'transparent transparent';
      }}
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
              className="w-full px-geist-3 py-geist-2 text-left rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 hover:border-geist-accents-3 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-geist-foreground/10 focus:border-geist-accents-4 cursor-pointer group"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {index < MAX_KEYBOARD_SHORTCUTS && (
                <kbd className="absolute top-geist-2 right-geist-2 px-geist-1 py-geist-1 text-label-12 text-geist-accents-5 bg-geist-accents-1 border border-geist-accents-2 rounded-geist opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {index + 1}
                </kbd>
              )}

              <div className="space-y-geist-1 pr-geist-6">
                <div className="flex items-start justify-between gap-geist-2">
                  <div className="text-label-12 text-geist-foreground break-words whitespace-pre-wrap">
                    {suggestionText}
                  </div>
                  {suggestionObj?.compatibility !== undefined &&
                    renderCompatibilityBadge(suggestionObj.compatibility)}
                </div>
                {suggestionObj?.explanation && (
                  <div className="text-label-12 text-geist-accents-5 break-words">
                    {suggestionObj.explanation}
                  </div>
                )}
              </div>

              {showCopyAction && suggestionText && (
                <div className="mt-geist-2 pt-geist-2 border-t border-geist-accents-2 flex items-center gap-geist-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <span
                    onClick={(e) => handleCopy(suggestionText, e)}
                    className="text-label-12 text-geist-accents-6 hover:text-geist-foreground transition-colors duration-150 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => handleCopyKeyDown(suggestionText, e)}
                  >
                    Copy
                  </span>
                  <span className="text-geist-accents-3">•</span>
                  <span className="text-label-12 text-geist-accents-5">Click to apply</span>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

