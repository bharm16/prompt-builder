import { useEffect } from 'react';

import type { PromptCanvasState } from '../types';

export interface UseSuggestionSelectionOptions {
  selectedSpanId: string | null;
  hasInteracted: boolean;
  setState: (payload: Partial<PromptCanvasState>) => void;
}

export function useSuggestionSelection({
  selectedSpanId,
  hasInteracted,
  setState,
}: UseSuggestionSelectionOptions): void {
  useEffect(() => {
    if (selectedSpanId && !hasInteracted) {
      setState({ hasInteracted: true });
    }
  }, [selectedSpanId, hasInteracted, setState]);

}
