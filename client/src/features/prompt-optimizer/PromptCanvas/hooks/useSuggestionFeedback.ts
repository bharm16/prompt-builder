import { useCallback, useEffect, useRef } from 'react';

import type { PromptCanvasState, SuggestionsData } from '../types';

export interface UseSuggestionFeedbackOptions {
  suggestionsData: SuggestionsData | null;
  selectedSpanId: string | null;
  onSuggestionClick?: (suggestion: unknown) => void;
  setState: (payload: Partial<PromptCanvasState>) => void;
}

export interface UseSuggestionFeedbackReturn {
  handleSuggestionClickWithFeedback: (suggestion: unknown) => void;
}

export function useSuggestionFeedback({
  suggestionsData,
  selectedSpanId,
  onSuggestionClick,
  setState,
}: UseSuggestionFeedbackOptions): UseSuggestionFeedbackReturn {
  const justReplacedTimeoutRef = useRef<number | null>(null);

  const clearJustReplacedTimeout = useCallback((): void => {
    if (justReplacedTimeoutRef.current) {
      window.clearTimeout(justReplacedTimeoutRef.current);
      justReplacedTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearJustReplacedTimeout(), [clearJustReplacedTimeout]);

  const handleSuggestionClickWithFeedback = useCallback(
    (suggestion: unknown): void => {
      const suggestionText =
        typeof suggestion === 'string'
          ? suggestion
          : (suggestion as { text?: string } | null)?.text || '';
      const from = suggestionsData?.selectedText || '';

      if (from && suggestionText) {
        setState({ justReplaced: { from, to: suggestionText } });
        clearJustReplacedTimeout();
        justReplacedTimeoutRef.current = window.setTimeout(() => {
          setState({ justReplaced: null });
          justReplacedTimeoutRef.current = null;
        }, 3000);
      }

      if (selectedSpanId) {
        setState({ lastAppliedSpanId: selectedSpanId });
      }

      onSuggestionClick?.(suggestion);
    },
    [suggestionsData?.selectedText, selectedSpanId, onSuggestionClick, setState, clearJustReplacedTimeout]
  );

  return { handleSuggestionClickWithFeedback };
}
