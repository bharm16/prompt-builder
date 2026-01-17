/**
 * Keyboard Shortcuts Hook
 *
 * Manages keyboard shortcuts for the Video Concept Builder.
 */

import { useEffect, useRef } from 'react';
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
  const optionsRef = useRef({ onSuggestionSelect, onEscape, onRefresh, activeElement, suggestions });

  useEffect(() => {
    optionsRef.current = { onSuggestionSelect, onEscape, onRefresh, activeElement, suggestions };
  }, [onSuggestionSelect, onEscape, onRefresh, activeElement, suggestions]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      const {
        onSuggestionSelect: onSuggestionSelectCurrent,
        onEscape: onEscapeCurrent,
        onRefresh: onRefreshCurrent,
        activeElement: activeElementCurrent,
        suggestions: suggestionsCurrent,
      } = optionsRef.current;

      // Only handle number keys when suggestions are visible
      if (!activeElementCurrent || suggestionsCurrent.length === 0) return;

      // Number keys (1-8) for suggestion selection
      const key = parseInt(e.key, 10);
      if (!Number.isNaN(key) && key >= 1 && key <= Math.min(suggestionsCurrent.length, 8)) {
        e.preventDefault();
        const suggestion = suggestionsCurrent[key - 1];
        if (suggestion) {
          onSuggestionSelectCurrent(suggestion);
        }
      }

      // Escape to close suggestions
      if (e.key === 'Escape' && activeElementCurrent) {
        onEscapeCurrent();
      }

      // 'r' to refresh suggestions
      if (e.key === 'r' && activeElementCurrent && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onRefreshCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}

