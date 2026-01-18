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
        className="flex flex-col gap-1.5"
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
              className="flex items-start justify-between gap-3 rounded-md border border-transparent bg-transparent px-2.5 py-2 transition-all duration-150 hover:-translate-y-px hover:bg-white/5 hover:border-white/10"
            >
              <Button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="min-w-0 flex-1 text-left text-body-sm font-medium leading-snug text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
                aria-label={`Apply suggestion: ${suggestionText}`}
              >
                {suggestionText}
              </Button>

              <Button
                type="button"
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="mt-0.5 h-6 flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 text-label-12 font-medium text-muted transition-all duration-150 hover:-translate-y-px hover:border-white/20 hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            className="group relative opacity-0 animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className="relative w-full rounded-lg border border-border bg-app p-3 text-left transition-all duration-150 hover:border-border-strong hover:bg-surface-1 hover:shadow-sm"
              role="listitem"
              aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
            >
              {/* Main clickable area for applying suggestion */}
              <Button
                onClick={() => handleSuggestionSelect(suggestionObj)}
                variant="ghost"
                className="w-full text-left cursor-pointer rounded transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                aria-label={`Apply suggestion: ${suggestionText.substring(0, 50)}...`}
              >
                {/* Keyboard Shortcut Badge */}
                {index < MAX_KEYBOARD_SHORTCUTS && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-label-sm font-mono text-muted shadow-sm">
                       {index + 1}
                     </kbd>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <span className="text-copy-13 font-medium text-foreground">
                      {suggestionText}
                    </span>
                    {suggestionObj?.compatibility !== undefined &&
                      renderCompatibilityBadge(suggestionObj.compatibility)}
                  </div>
                  
                  {suggestionObj?.explanation && (
                    <p className="text-label-12 leading-relaxed text-muted">
                      {suggestionObj.explanation}
                    </p>
                  )}
                </div>
              </Button>

              {/* Action Footer - Only shows on hover, outside main button */}
              {showCopyAction && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 opacity-0 transition-opacity group-hover:opacity-100">
                   <span className="text-label-sm font-medium uppercase tracking-widest text-muted">
                     Click to Apply
                   </span>
                   <Button
                     type="button"
                     onClick={(e) => handleCopy(suggestionText, index, e)}
                     onKeyDown={(e) => handleCopyKeyDown(suggestionText, index, e)}
                     variant="ghost"
                     className="rounded px-1 text-label-sm font-medium uppercase tracking-widest text-muted transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
