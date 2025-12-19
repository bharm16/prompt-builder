/**
 * useSuggestionDetection Hook
 * 
 * Detects when suggestions are applied and triggers immediate relabeling.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useEffect, useRef } from 'react';

export interface UseSuggestionDetectionOptions {
  displayedPrompt: string | null;
  isSuggestionsOpen: boolean;
  refreshLabeling?: (() => void) | null;
}

/**
 * Detects when a suggestion is applied (suggestions panel closes + prompt changes)
 * and triggers immediate relabeling.
 */
export function useSuggestionDetection({
  displayedPrompt,
  isSuggestionsOpen,
  refreshLabeling,
}: UseSuggestionDetectionOptions): void {
  const suggestionAppliedRef = useRef<boolean>(false);
  const previousDisplayedPromptRef = useRef<string>(displayedPrompt ?? '');
  const previousSuggestionsOpenRef = useRef<boolean>(isSuggestionsOpen);

  // Detect when a suggestion is applied (suggestions panel closes + prompt changes)
  useEffect(() => {
    const currentPrompt = displayedPrompt ?? '';
    const previousPrompt = previousDisplayedPromptRef.current;
    const wasSuggestionsOpen = previousSuggestionsOpenRef.current;
    const isNowSuggestionsClosed = !isSuggestionsOpen;

    // Detect suggestion application: suggestions panel was open, now closed, and prompt changed
    if (wasSuggestionsOpen && isNowSuggestionsClosed && currentPrompt !== previousPrompt) {
      suggestionAppliedRef.current = true;
    }

    // Update refs for next comparison
    previousDisplayedPromptRef.current = currentPrompt;
    previousSuggestionsOpenRef.current = isSuggestionsOpen;
  }, [displayedPrompt, isSuggestionsOpen]);

  // Trigger immediate relabeling when a suggestion is applied
  useEffect(() => {
    if (suggestionAppliedRef.current) {
      suggestionAppliedRef.current = false;
      // Defer to next tick so useSpanLabeling's main effect runs first
      const timeoutId = setTimeout(() => {
        refreshLabeling?.();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedPrompt]); // Intentionally omit refreshLabeling - we only care about prompt changes
}

