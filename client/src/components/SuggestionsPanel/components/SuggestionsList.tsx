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
              className="w-full text-left relative p-geist-3 rounded-geist-lg bg-geist-background border border-geist-accents-2 hover:bg-geist-accents-1 hover:border-geist-accents-3 hover:shadow-geist-small active:scale-[0.99] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-5 cursor-pointer group"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {/* Keyboard Shortcut Badge */}
              {index < MAX_KEYBOARD_SHORTCUTS && (
                <div className="absolute top-geist-2 right-geist-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <kbd className="px-1.5 py-0.5 bg-white border border-geist-accents-2 rounded-md text-[10px] font-mono text-geist-accents-5 shadow-sm">
                     {index + 1}
                   </kbd>
                </div>
              )}

              <div className="space-y-geist-1">
                <div className="flex items-start justify-between gap-geist-2 pr-6">
                  <span className="text-copy-13 text-geist-foreground font-medium">
                    {suggestionText}
                  </span>
                  {suggestionObj?.compatibility !== undefined &&
                    renderCompatibilityBadge(suggestionObj.compatibility)}
                </div>
                
                {suggestionObj?.explanation && (
                  <p className="text-label-12 text-geist-accents-5 leading-relaxed">
                    {suggestionObj.explanation}
                  </p>
                )}
              </div>

              {/* Action Footer - Only shows on hover */}
              {showCopyAction && (
                <div className="mt-geist-3 pt-geist-2 border-t border-geist-accents-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[11px] font-medium text-geist-accents-5 uppercase tracking-wide">
                     Click to Apply
                   </span>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

