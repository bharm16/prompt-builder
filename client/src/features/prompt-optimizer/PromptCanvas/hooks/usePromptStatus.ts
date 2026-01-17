import { useEffect, useRef } from 'react';

import type { PromptCanvasState } from '../types';

export interface UsePromptStatusOptions {
  displayedPrompt: string | null;
  inputPrompt: string;
  isDraftReady: boolean;
  isRefining: boolean;
  isProcessing: boolean;
  generatedTimestamp: number | null;
  setState: (payload: Partial<PromptCanvasState>) => void;
}

export function usePromptStatus({
  displayedPrompt,
  inputPrompt,
  isDraftReady,
  isRefining,
  isProcessing,
  generatedTimestamp,
  setState,
}: UsePromptStatusOptions): void {
  // Track if we've already set the timestamp for the current draft to avoid re-renders
  const hasSetTimestampRef = useRef(false);

  useEffect(() => {
    if (!displayedPrompt) {
      hasSetTimestampRef.current = false;
      setState({ promptState: 'generated', generatedTimestamp: null });
      return;
    }

    if (displayedPrompt === inputPrompt) {
      setState({ promptState: 'synced' });
      return;
    }

    if (isDraftReady && !isRefining && !isProcessing) {
      // Only set timestamp once per draft to prevent loops
      if (!generatedTimestamp && !hasSetTimestampRef.current) {
        hasSetTimestampRef.current = true;
        setState({
          promptState: 'generated',
          generatedTimestamp: Date.now(),
        });
      } else {
        setState({ promptState: 'generated' });
      }
      return;
    }

    hasSetTimestampRef.current = false;
    setState({ promptState: 'edited' });
  }, [
    displayedPrompt,
    inputPrompt,
    isDraftReady,
    isRefining,
    isProcessing,
    // Removed generatedTimestamp from deps - we use ref to track if we've set it
    setState,
  ]);
}
