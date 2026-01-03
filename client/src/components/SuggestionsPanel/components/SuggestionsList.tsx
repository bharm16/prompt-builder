/**
 * SuggestionsList Component
 *
 * Renders list of suggestions with keyboard shortcuts, copy functionality, and compatibility badges.
 * Following VideoConceptBuilder pattern: components/ElementCard.tsx
 */

import { useState, useCallback } from 'react';
import { renderCompatibilityBadge, normalizeSuggestion } from '../utils/suggestionHelpers';
import { MAX_KEYBOARD_SHORTCUTS } from '../config/panelConfig';
import { simpleHash } from '@/features/prompt-optimizer/utils/SuggestionCache';
import { logger } from '@/services/LoggingService';
import { useToast } from '@/components/Toast';
import type { SuggestionItem } from '../hooks/types';

/**
 * Generate deterministic key for a suggestion.
 * Uses backend ID if available, otherwise hash + index.
 *
 * @param suggestion - The suggestion item
 * @param index - The index in the list
 * @returns A unique key string
 */
export function generateSuggestionKey(suggestion: SuggestionItem, index: number): string {
  if (suggestion.id) {
    return suggestion.id;
  }
  const hash = simpleHash(suggestion.text || '');
  return `suggestion_${hash}_${index}`;
}

interface SuggestionsListProps {
  suggestions?: SuggestionItem[];
  onSuggestionClick?: (suggestion: SuggestionItem | string) => void | Promise<void>;
  isPlaceholder?: boolean;
  showCopyAction?: boolean;
  variant?: 'default' | 'tokenEditor';
}

export function SuggestionsList({
  suggestions = [],
  onSuggestionClick = () => {},
  isPlaceholder = false,
  showCopyAction = true,
  variant = 'default',
}: SuggestionsListProps): React.ReactElement | null {
  const toast = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const log = logger.child('SuggestionsList');

  if (suggestions.length === 0) {
    return null;
  }

  const handleSuggestionSelect = (suggestion: SuggestionItem): void => {
    const payload = normalizeSuggestion(suggestion);
    if (payload) {
      onSuggestionClick(payload);
    }
  };

  if (variant === 'tokenEditor') {
    return (
      <div
        className="flex-1 min-h-0 overflow-y-auto px-geist-4 pb-geist-3 pt-geist-2 space-y-1 scrollbar-hide"
        role="list"
        aria-label="Suggestion options"
      >
        {suggestions.map((suggestion, index) => {
          const suggestionObj = normalizeSuggestion(suggestion);
          if (!suggestionObj) return null;
          const suggestionText = suggestionObj.text || '';
          const key = generateSuggestionKey(suggestionObj, index);

          return (
            <div
              key={key}
              role="listitem"
              className="flex items-center justify-between gap-geist-3 py-2"
            >
              <button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-5 rounded-geist"
                aria-label={`Apply suggestion: ${suggestionText}`}
              >
                <span className="text-copy-13 text-geist-foreground truncate">
                  • {suggestionText}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                className="flex-shrink-0 inline-flex items-center justify-center px-geist-2.5 py-1 text-label-12 font-medium bg-geist-foreground text-geist-background rounded-geist hover:bg-geist-accents-8 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-5"
                aria-label={`Apply ${suggestionText}`}
              >
                Apply
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  /**
   * Copy text to clipboard with error handling.
   * Shows visual feedback on success, logs warning on failure.
   * Requirement 9.1: Visual feedback on success
   * Requirement 9.2: Handle errors gracefully without crashing
   */
  const copyToClipboard = useCallback(async (text: string, index: number): Promise<void> => {
    if (typeof navigator === 'undefined' || !navigator?.clipboard) {
      log.warn('Clipboard API not available', { component: 'SuggestionsList' });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      // Show visual feedback on success
      setCopiedIndex(index);
      toast.success('Copied to clipboard!', 1500);
      // Reset copied state after brief delay
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (error) {
      // Log warning on failure, don't crash
      log.warn('Failed to copy to clipboard', {
        component: 'SuggestionsList',
        error: error instanceof Error ? error.message : String(error),
        textLength: text.length,
      });
      // Optionally show user-friendly feedback
      toast.error('Failed to copy', 1500);
    }
  }, [log, toast]);

  const handleCopy = (text: string, index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    void copyToClipboard(text, index);
  };

  const handleCopyKeyDown = (text: string, index: number, e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      e.preventDefault();
      void copyToClipboard(text, index);
    }
  };

  return (
    <div
      className="flex-1 min-h-0 space-y-geist-2 overflow-y-auto px-geist-3 py-geist-3 scrollbar-hide"
      role="list"
      aria-label="Suggestion options"
    >
      {suggestions.map((suggestion, index) => {
        const suggestionObj = normalizeSuggestion(suggestion);
        if (!suggestionObj) {
          return null;
        }
        const suggestionText = suggestionObj.text;
        const key = generateSuggestionKey(suggestionObj, index);

        return (
          <div
            key={key}
            className="group relative animate-[slideIn_0.3s_ease-out_forwards] opacity-0"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className="w-full text-left relative p-geist-3 rounded-geist-lg bg-geist-background border border-geist-accents-2 hover:bg-geist-accents-1 hover:border-geist-accents-3 hover:shadow-geist-small transition-all duration-150 group"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {/* Main clickable area for applying suggestion */}
              <button
                onClick={() => handleSuggestionSelect(suggestionObj)}
                className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-5 rounded active:scale-[0.99] transition-transform"
                aria-label={`Apply suggestion: ${suggestionText.substring(0, 50)}...`}
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
              </button>

              {/* Action Footer - Only shows on hover, outside main button */}
              {showCopyAction && (
                <div className="mt-geist-3 pt-geist-2 border-t border-geist-accents-2 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[11px] font-medium text-geist-accents-5 uppercase tracking-wide">
                     Click to Apply
                   </span>
                   <button
                     type="button"
                     onClick={(e) => handleCopy(suggestionText, index, e)}
                     onKeyDown={(e) => handleCopyKeyDown(suggestionText, index, e)}
                     className="text-[11px] font-medium text-geist-accents-5 hover:text-geist-foreground uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-geist-accents-5 rounded px-1"
                     aria-label={`Copy suggestion ${index + 1}`}
                   >
                     {copiedIndex === index ? 'Copied!' : 'Copy'}
                   </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
