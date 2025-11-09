import { useCallback } from 'react';

/**
 * Custom hook for the improvement flow
 * Handles improvement modal and integrates with optimization
 */
export function useImprovementFlow({
  promptOptimizer,
  toast,
  setShowImprover,
  handleOptimize,
}) {
  /**
   * Initiate improvement flow
   */
  const handleImproveFirst = useCallback(() => {
    if (!promptOptimizer.inputPrompt.trim()) {
      toast.warning('Please enter a prompt first');
      return;
    }
    setShowImprover(true);
  }, [promptOptimizer, toast, setShowImprover]);

  /**
   * Handle completion of improvement modal
   */
  const handleImprovementComplete = useCallback(async (enhancedPrompt, context) => {
    setShowImprover(false);
    promptOptimizer.setImprovementContext(context);
    promptOptimizer.setInputPrompt(enhancedPrompt);
    handleOptimize(enhancedPrompt, context);
  }, [setShowImprover, promptOptimizer, handleOptimize]);

  return {
    handleImproveFirst,
    handleImprovementComplete,
  };
}

