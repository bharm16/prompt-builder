import { useEffect } from 'react';

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
  useEffect(() => {
    if (!displayedPrompt) {
      setState({ promptState: 'generated', generatedTimestamp: null });
      return;
    }

    if (displayedPrompt === inputPrompt) {
      setState({ promptState: 'synced' });
      return;
    }

    if (isDraftReady && !isRefining && !isProcessing) {
      setState({
        promptState: 'generated',
        ...(generatedTimestamp ? {} : { generatedTimestamp: Date.now() }),
      });
      return;
    }

    setState({ promptState: 'edited' });
  }, [
    displayedPrompt,
    inputPrompt,
    isDraftReady,
    isRefining,
    isProcessing,
    generatedTimestamp,
    setState,
  ]);
}
