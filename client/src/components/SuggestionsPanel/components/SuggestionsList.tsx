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
import { Button } from '@promptstudio/system/components/ui/button';
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
        className="suggestions-panel__token-list"
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
              className="suggestions-panel__token-row"
            >
              <Button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="suggestions-panel__token-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
                aria-label={`Apply suggestion: ${suggestionText}`}
              >
                {suggestionText}
              </Button>

              <Button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="suggestions-panel__token-apply flex-shrink-0 text-label-12 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Apply ${suggestionText}`}
              >
                Apply
              </Button>
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
      className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-3 ps-scrollbar-hide"
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
              className="w-full text-left relative p-3 rounded-lg bg-app border border-border hover:bg-surface-1 hover:border-border-strong hover:shadow-sm transition-all duration-150 group"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {/* Main clickable area for applying suggestion */}
              <Button
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded active:scale-[0.99] transition-transform"
                aria-label={`Apply suggestion: ${suggestionText.substring(0, 50)}...`}
              >
                {/* Keyboard Shortcut Badge */}
                {index < MAX_KEYBOARD_SHORTCUTS && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <kbd className="px-1.5 py-0.5 bg-white border border-border rounded-md text-[10px] font-mono text-muted shadow-sm">
                       {index + 1}
                     </kbd>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <span className="text-copy-13 text-foreground font-medium">
                      {suggestionText}
                    </span>
                    {suggestionObj?.compatibility !== undefined &&
                      renderCompatibilityBadge(suggestionObj.compatibility)}
                  </div>
                  
                  {suggestionObj?.explanation && (
                    <p className="text-label-12 text-muted leading-relaxed">
                      {suggestionObj.explanation}
                    </p>
                  )}
                </div>
              </Button>

              {/* Action Footer - Only shows on hover, outside main button */}
              {showCopyAction && (
                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-[11px] font-medium text-muted uppercase tracking-wide">
                     Click to Apply
                   </span>
                   <Button
                     type="button"
                     onClick={(e) => handleCopy(suggestionText, index, e)}
                     onKeyDown={(e) => handleCopyKeyDown(suggestionText, index, e)}
                     variant="ghost"
                     className="text-[11px] font-medium text-muted hover:text-foreground uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
                     aria-label={`Copy suggestion ${index + 1}`}
                   >
                     {copiedIndex === index ? 'Copied!' : 'Copy'}
                   </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
