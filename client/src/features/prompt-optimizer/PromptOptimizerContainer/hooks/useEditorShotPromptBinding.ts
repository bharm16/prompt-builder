import { useEffect, useMemo, useRef } from 'react';
import type { ContinuityShot, UpdateShotInput } from '@/features/continuity/types';
import { debounce } from '@/features/prompt-optimizer/utils/debounce';
import { logger } from '@/services/LoggingService';

const log = logger.child('useEditorShotPromptBinding');

interface PromptOptimizerLike {
  inputPrompt: string;
  displayedPrompt: string;
  setInputPrompt: (prompt: string) => void;
}

interface UseEditorShotPromptBindingParams {
  currentEditorShot: ContinuityShot | null;
  hasActiveContinuityShot: boolean;
  promptOptimizer: PromptOptimizerLike;
  updateShot: (shotId: string, updates: UpdateShotInput) => Promise<ContinuityShot>;
  setDisplayedPromptSilently: (text: string) => void;
  setShowResults: (show: boolean) => void;
  debounceMs?: number;
}

export function useEditorShotPromptBinding({
  currentEditorShot,
  hasActiveContinuityShot,
  promptOptimizer,
  updateShot,
  setDisplayedPromptSilently,
  setShowResults,
  debounceMs = 500,
}: UseEditorShotPromptBindingParams): void {
  const lastSyncedShotIdRef = useRef<string | null>(null);

  const debouncedPersistPrompt = useMemo(
    () =>
      debounce((shotId: string, prompt: string) => {
        void updateShot(shotId, { prompt }).catch((error) => {
          log.warn('Failed to persist shot prompt update', {
            shotId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, debounceMs),
    [debounceMs, updateShot]
  );

  useEffect(() => {
    return () => {
      debouncedPersistPrompt.cancel();
    };
  }, [debouncedPersistPrompt]);

  useEffect(() => {
    if (!currentEditorShot) {
      lastSyncedShotIdRef.current = null;
      return;
    }

    // Only sync from shot -> editor when the selected shot changes.
    if (lastSyncedShotIdRef.current === currentEditorShot.id) {
      return;
    }
    lastSyncedShotIdRef.current = currentEditorShot.id;
    debouncedPersistPrompt.cancel();

    const nextPrompt = currentEditorShot.userPrompt ?? '';
    if (promptOptimizer.inputPrompt !== nextPrompt) {
      promptOptimizer.setInputPrompt(nextPrompt);
    }

    if (promptOptimizer.displayedPrompt.trim()) {
      setDisplayedPromptSilently('');
      setShowResults(false);
    }
  }, [
    currentEditorShot,
    promptOptimizer,
    setDisplayedPromptSilently,
    setShowResults,
    debouncedPersistPrompt,
  ]);

  useEffect(() => {
    if (!hasActiveContinuityShot || !currentEditorShot) {
      debouncedPersistPrompt.cancel();
      return;
    }

    const shotPrompt = currentEditorShot.userPrompt ?? '';
    const nextPrompt = promptOptimizer.inputPrompt;
    if (shotPrompt === nextPrompt) {
      debouncedPersistPrompt.cancel();
      return;
    }

    debouncedPersistPrompt(currentEditorShot.id, nextPrompt);
  }, [
    currentEditorShot,
    hasActiveContinuityShot,
    promptOptimizer.inputPrompt,
    debouncedPersistPrompt,
  ]);
}
