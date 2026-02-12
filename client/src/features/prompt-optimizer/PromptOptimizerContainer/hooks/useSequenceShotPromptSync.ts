import { useEffect, useRef } from 'react';
import type { ContinuityShot } from '@/features/continuity/types';

interface PromptOptimizerLike {
  inputPrompt: string;
  displayedPrompt: string;
  setInputPrompt: (prompt: string) => void;
}

interface UseSequenceShotPromptSyncParams {
  isSequenceMode: boolean;
  currentShot: ContinuityShot | null;
  promptOptimizer: PromptOptimizerLike;
  setDisplayedPromptSilently: (text: string) => void;
  setShowResults: (show: boolean) => void;
}

export function useSequenceShotPromptSync({
  isSequenceMode,
  currentShot,
  promptOptimizer,
  setDisplayedPromptSilently,
  setShowResults,
}: UseSequenceShotPromptSyncParams): void {
  const lastSyncedShotIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSequenceMode || !currentShot) {
      lastSyncedShotIdRef.current = null;
      return;
    }

    // Only sync when the selected shot changes; avoid clobbering active edits.
    if (lastSyncedShotIdRef.current === currentShot.id) {
      return;
    }
    lastSyncedShotIdRef.current = currentShot.id;

    const nextPrompt = currentShot.userPrompt ?? '';
    if (promptOptimizer.inputPrompt !== nextPrompt) {
      promptOptimizer.setInputPrompt(nextPrompt);
    }

    if (promptOptimizer.displayedPrompt.trim()) {
      setDisplayedPromptSilently('');
      setShowResults(false);
    }
  }, [
    currentShot?.id,
    currentShot?.userPrompt,
    isSequenceMode,
    promptOptimizer,
    setDisplayedPromptSilently,
    setShowResults,
  ]);
}
