import { useCallback } from 'react';
import type { Toast } from '@hooks/types';
import type { OptimizationOptions } from '../../types';

interface PromptOptimizer {
  inputPrompt: string;
  setInputPrompt: (prompt: string) => void;
  setImprovementContext: (context: Record<string, unknown> | null) => void;
}

interface UseImprovementFlowParams {
  promptOptimizer: PromptOptimizer;
  toast: Toast;
  setShowImprover: (show: boolean) => void;
  handleOptimize: (prompt: string, context: Record<string, unknown> | null, options?: OptimizationOptions) => void;
}

/**
 * Custom hook for the improvement flow
 * Handles improvement modal and integrates with optimization
 */
export function useImprovementFlow({
  promptOptimizer,
  toast,
  setShowImprover,
  handleOptimize,
}: UseImprovementFlowParams): {
  handleImproveFirst: () => void;
  handleImprovementComplete: (
    enhancedPrompt: string,
    context: unknown
  ) => Promise<void>;
} {
  const {
    inputPrompt,
    setInputPrompt,
    setImprovementContext,
  } = promptOptimizer;
  /**
   * Initiate improvement flow
   */
  const handleImproveFirst = useCallback(() => {
    if (!inputPrompt.trim()) {
      toast.warning('Please enter a prompt first');
      return;
    }
    setShowImprover(true);
  }, [inputPrompt, toast, setShowImprover]);

  /**
   * Handle completion of improvement modal
   */
  const handleImprovementComplete = useCallback(
    async (enhancedPrompt: string, context: unknown): Promise<void> => {
      setShowImprover(false);
      const ctx = (context ?? null) as Record<string, unknown> | null;
      setImprovementContext(ctx);
      setInputPrompt(enhancedPrompt);
      handleOptimize(enhancedPrompt, ctx);
    },
    [setShowImprover, setImprovementContext, setInputPrompt, handleOptimize]
  );

  return {
    handleImproveFirst,
    handleImprovementComplete,
  };
}
