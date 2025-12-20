import { useCallback, useEffect, useRef } from 'react';
import { PromptContext } from '@utils/PromptContext';
import { PERFORMANCE_CONFIG } from '@config/performance.config';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot } from '../../context/types';

interface PromptOptimizer {
  setInputPrompt: (prompt: string) => void;
  optimize: (
    prompt: string,
    context: unknown | null,
    brainstormContext: unknown
  ) => Promise<{ optimized: string; score: number | null } | null>;
  [key: string]: unknown;
}

interface PromptHistory {
  saveToHistory: (
    input: string,
    output: string,
    score: number | null,
    mode: string,
    context: unknown
  ) => Promise<{ uuid: string; id?: string | null } | null>;
  [key: string]: unknown;
}

interface UseConceptBrainstormParams {
  promptOptimizer: PromptOptimizer;
  promptHistory: PromptHistory;
  selectedMode: string;
  setConceptElements: (elements: Record<string, unknown>) => void;
  setPromptContext: (context: PromptContext | null) => void;
  setShowBrainstorm: (show: boolean) => void;
  setCurrentPromptUuid: (uuid: string) => void;
  setCurrentPromptDocId: (id: string | null) => void;
  setDisplayedPromptSilently: (prompt: string) => void;
  setShowResults: (show: boolean) => void;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  resetEditStacks: () => void;
  persistedSignatureRef: React.MutableRefObject<string | null>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  toast: Toast;
}

/**
 * Custom hook for video concept brainstorm flow
 * Handles concept generation, context management, and automatic optimization
 */
export function useConceptBrainstorm({
  promptOptimizer,
  promptHistory,
  selectedMode,
  setConceptElements,
  setPromptContext,
  setShowBrainstorm,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setDisplayedPromptSilently,
  setShowResults,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  persistedSignatureRef,
  skipLoadFromUrlRef,
  navigate,
  toast,
}: UseConceptBrainstormParams): {
  handleConceptComplete: (
    finalConcept: string,
    elements: Record<string, unknown>,
    metadata: Record<string, unknown>
  ) => Promise<void>;
  handleSkipBrainstorm: () => void;
} {
  const conceptOptimizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (conceptOptimizeTimeoutRef.current) {
        clearTimeout(conceptOptimizeTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle concept completion from brainstorm modal
   */
  const handleConceptComplete = useCallback(
    async (
      finalConcept: string,
      elements: Record<string, unknown>,
      metadata: Record<string, unknown>
    ): Promise<void> => {
      setConceptElements(elements);

      // Create and store prompt context
      const context = new PromptContext(elements, metadata);
      setPromptContext(context);

      const serializedContext = context.toJSON();
      const brainstormContextData = {
        elements,
        metadata,
      };

      promptOptimizer.setInputPrompt(finalConcept);
      setShowBrainstorm(false);

      // Clear any existing timeout and set new one for optimization
      if (conceptOptimizeTimeoutRef.current) {
        clearTimeout(conceptOptimizeTimeoutRef.current);
      }

      conceptOptimizeTimeoutRef.current = setTimeout(async () => {
        try {
          const result = await promptOptimizer.optimize(
            finalConcept,
            null,
            brainstormContextData
          );

          if (result) {
            const saveResult = await promptHistory.saveToHistory(
              finalConcept,
              result.optimized,
              result.score,
              selectedMode,
              serializedContext
            );

            if (saveResult?.uuid) {
              setDisplayedPromptSilently(result.optimized);

              skipLoadFromUrlRef.current = true;
              setCurrentPromptUuid(saveResult.uuid);
              setCurrentPromptDocId(saveResult.id ?? null);
              setShowResults(true);
              toast.success('Video prompt generated successfully!');

              applyInitialHighlightSnapshot(null, {
                bumpVersion: true,
                markPersisted: false,
              });
              resetEditStacks();
              persistedSignatureRef.current = null;
              navigate(`/prompt/${saveResult.uuid}`, { replace: true });
            }
          }
        } catch (error) {
          toast.error('Failed to generate video prompt. Please try again.');
          console.error('Error in handleConceptComplete:', error);
        } finally {
          conceptOptimizeTimeoutRef.current = null;
        }
      }, PERFORMANCE_CONFIG.ASYNC_OPERATION_DELAY_MS);
    },
    [
      promptOptimizer,
      promptHistory,
      selectedMode,
      setConceptElements,
      setPromptContext,
      setShowBrainstorm,
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      setDisplayedPromptSilently,
      setShowResults,
      applyInitialHighlightSnapshot,
      resetEditStacks,
      persistedSignatureRef,
      skipLoadFromUrlRef,
      navigate,
      toast,
    ]
  );

  /**
   * Handle skipping brainstorm modal
   */
  const handleSkipBrainstorm = useCallback(() => {
    setShowBrainstorm(false);
    setConceptElements({ skipped: true });
  }, [setShowBrainstorm, setConceptElements]);

  return {
    handleConceptComplete,
    handleSkipBrainstorm,
  };
}
