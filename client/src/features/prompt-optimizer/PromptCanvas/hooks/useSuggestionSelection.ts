import { useEffect } from 'react';

import type { PromptCanvasState } from '../types';

export interface UseSuggestionSelectionOptions {
  selectedSpanId: string | null;
  hasInteracted: boolean;
  isSuggestionsOpen: boolean;
  setState: (payload: Partial<PromptCanvasState>) => void;
}

export function useSuggestionSelection({
  selectedSpanId,
  hasInteracted,
  isSuggestionsOpen,
  setState,
}: UseSuggestionSelectionOptions): void {
  useEffect(() => {
    if (selectedSpanId && !hasInteracted) {
      setState({ hasInteracted: true });
    }
  }, [selectedSpanId, hasInteracted, setState]);

  useEffect(() => {
    if (!isSuggestionsOpen && selectedSpanId) {
      setState({ selectedSpanId: null });
    }
  }, [isSuggestionsOpen, selectedSpanId, setState]);
}
