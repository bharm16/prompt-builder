/**
 * Keyboard Shortcuts Hook
 *
 * Manages keyboard shortcuts for the Video Concept Builder.
 */

import { useEffect } from 'react';
import type { ElementKey } from './types';

interface UseKeyboardShortcutsOptions {
  onSuggestionSelect: (suggestion: string) => void;
  onEscape: () => void;
  onRefresh: () => void;
  activeElement: ElementKey | null;
  suggestions: string[];
}

/**
 * Custom hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts({
  onSuggestionSelect,
  onEscape,
  onRefresh,
  activeElement,
  suggestions,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Only handle number keys when suggestions are visible
      if (!activeElement || suggestions.length === 0) return;

      // Number keys (1-8) for suggestion selection
      const key = parseInt(e.key, 10);
      if (!Number.isNaN(key) && key >= 1 && key <= Math.min(suggestions.length, 8)) {
        e.preventDefault();
        const suggestion = suggestions[key - 1];
        if (suggestion) {
          onSuggestionSelect(suggestion);
        }
      }

      // Escape to close suggestions
      if (e.key === 'Escape' && activeElement) {
        onEscape();
      }

      // 'r' to refresh suggestions
      if (e.key === 'r' && activeElement && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeElement, suggestions, onSuggestionSelect, onEscape, onRefresh]);
}

