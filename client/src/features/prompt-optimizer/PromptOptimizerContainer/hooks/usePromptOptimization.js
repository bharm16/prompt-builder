import { useCallback } from 'react';

/**
 * Custom hook for prompt optimization orchestration
 * Handles the optimization flow including saving to history and navigation
 */
export function usePromptOptimization({
  promptOptimizer,
  promptHistory,
  promptContext,
  selectedMode,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setDisplayedPromptSilently,
  setShowResults,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  persistedSignatureRef,
  skipLoadFromUrlRef,
  navigate,
}) {
  /**
   * Handle prompt optimization
   */
  const handleOptimize = useCallback(async (promptToOptimize, context) => {
    const prompt = promptToOptimize || promptOptimizer.inputPrompt;
    const ctx = context || promptOptimizer.improvementContext;

    // Serialize prompt context
    const serializedContext = promptContext
      ? typeof promptContext.toJSON === 'function'
        ? promptContext.toJSON()
        : {
            elements: promptContext.elements,
            metadata: promptContext.metadata,
          }
      : null;

    const brainstormContextData = serializedContext
      ? {
          elements: serializedContext.elements,
          metadata: serializedContext.metadata,
        }
      : null;

    // Optimize the prompt
    const result = await promptOptimizer.optimize(prompt, ctx, brainstormContextData);
    
    if (result) {
      // Save to history
      const saveResult = await promptHistory.saveToHistory(
        prompt,
        result.optimized,
        result.score,
        selectedMode,
        serializedContext
      );

      if (saveResult?.uuid) {
        // Update state
        skipLoadFromUrlRef.current = true;
        setCurrentPromptUuid(saveResult.uuid);
        setCurrentPromptDocId(saveResult.id ?? null);
        setDisplayedPromptSilently(result.optimized);
        setShowResults(true);
        
        // Reset highlights and stacks
        applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
        resetEditStacks();
        persistedSignatureRef.current = null;
        
        // Navigate to the new prompt URL
        if (saveResult.uuid) {
          navigate(`/prompt/${saveResult.uuid}`, { replace: true });
        }
      }
    }
  }, [
    promptOptimizer,
    promptHistory,
    promptContext,
    selectedMode,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    setDisplayedPromptSilently,
    setShowResults,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    persistedSignatureRef,
    skipLoadFromUrlRef,
    navigate,
  ]);

  return { handleOptimize };
}

