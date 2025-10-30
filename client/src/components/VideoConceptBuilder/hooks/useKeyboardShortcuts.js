/**
 * Keyboard Shortcuts Hook
 *
 * Manages keyboard shortcuts for the Video Concept Builder.
 */

import { useEffect } from 'react';

/**
 * Custom hook for managing keyboard shortcuts
 * @param {Object} options - Configuration options
 * @param {Function} options.onSuggestionSelect - Callback when suggestion is selected (1-8)
 * @param {Function} options.onEscape - Callback when Escape is pressed
 * @param {Function} options.onRefresh - Callback when 'r' is pressed
 * @param {string|null} options.activeElement - Currently active element
 * @param {Array} options.suggestions - Current suggestions
 */
export function useKeyboardShortcuts({
  onSuggestionSelect,
  onEscape,
  onRefresh,
  activeElement,
  suggestions,
}) {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle number keys when suggestions are visible
      if (!activeElement || suggestions.length === 0) return;

      // Number keys (1-8) for suggestion selection
      const key = parseInt(e.key);
      if (key >= 1 && key <= Math.min(suggestions.length, 8)) {
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
