import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { OptimizationOptions } from '../../types';
import type { CapabilityValues } from '@shared/capabilities';

interface PromptOptimizer {
  inputPrompt: string;
  genericOptimizedPrompt?: string | null;
  improvementContext: unknown;
  optimize: (
    prompt: string,
    context: unknown | null,
    brainstormContext: unknown | null,
    targetModel?: string,
    options?: OptimizationOptions
  ) => Promise<{ optimized: string; score: number | null } | null>;
  compile: (
    prompt: string,
    targetModel?: string,
    context?: unknown | null
  ) => Promise<{ optimized: string; score: number | null } | null>;
  [key: string]: unknown;
}

interface PromptHistory {
  saveToHistory: (
    input: string,
    output: string,
    score: number | null,
    mode: string,
    targetModel?: string | null,
    generationParams?: Record<string, unknown> | null,
    brainstormContext?: unknown | null,
    highlightCache?: unknown,
    existingUuid?: string | null
  ) => Promise<{ uuid: string; id?: string } | null>;
  [key: string]: unknown;
}

export interface UsePromptOptimizationParams {
  promptOptimizer: PromptOptimizer;
  promptHistory: PromptHistory;
  promptContext: PromptContext | null;
  selectedMode: string;
  selectedModel?: string; // New: optional selected model
  generationParams: CapabilityValues;
  currentPromptUuid: string | null;
  setCurrentPromptUuid: (uuid: string) => void;
  setCurrentPromptDocId: (id: string | null) => void;
  setDisplayedPromptSilently: (prompt: string) => void;
  setShowResults: (show: boolean) => void;
  applyInitialHighlightSnapshot: (
    highlight: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  resetEditStacks: () => void;
  persistedSignatureRef: React.MutableRefObject<string | null>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
  navigate: NavigateFunction;
}

export interface UsePromptOptimizationReturn {
  handleOptimize: (
    promptToOptimize?: string,
    context?: unknown,
    options?: OptimizationOptions
  ) => Promise<void>;
}

/**
 * Custom hook for prompt optimization orchestration
 * Handles the optimization flow including saving to history and navigation
 */
export function usePromptOptimization({
  promptOptimizer,
  promptHistory,
  promptContext,
  selectedMode,
  selectedModel, // Extract new param
  generationParams,
  currentPromptUuid,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setDisplayedPromptSilently,
  setShowResults,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  persistedSignatureRef,
  skipLoadFromUrlRef,
  navigate,
}: UsePromptOptimizationParams): UsePromptOptimizationReturn {
  /**
   * Handle prompt optimization
   */
  const handleOptimize = useCallback(
    async (
      promptToOptimize?: string,
      context?: unknown,
      options?: OptimizationOptions
    ): Promise<void> => {
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

      const isCompileOnly = options?.compileOnly === true;
      const compilePrompt =
        options?.compilePrompt ||
        (typeof promptOptimizer.genericOptimizedPrompt === 'string'
          ? promptOptimizer.genericOptimizedPrompt
          : null);

      const result = isCompileOnly
        ? await promptOptimizer.compile(
            compilePrompt || prompt,
            selectedMode === 'video' ? selectedModel : undefined,
            ctx
          )
        : await promptOptimizer.optimize(
            prompt,
            ctx,
            brainstormContextData,
            selectedMode === 'video' ? selectedModel : undefined,
            {
              ...options,
              ...(generationParams ? { generationParams } : {}),
            }
          );
      
      if (result) {
        // Save to history
        const saveResult = await promptHistory.saveToHistory(
          prompt,
          result.optimized,
          result.score,
          selectedMode,
          selectedMode === 'video' ? selectedModel ?? null : null,
          (generationParams as unknown as Record<string, unknown>) ?? null,
          serializedContext,
          null,
          currentPromptUuid
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
    },
    [
      promptOptimizer,
      promptHistory,
      promptContext,
      selectedMode,
      selectedModel, // Added dependency
      generationParams,
      currentPromptUuid,
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      setDisplayedPromptSilently,
      setShowResults,
      applyInitialHighlightSnapshot,
      resetEditStacks,
      persistedSignatureRef,
      skipLoadFromUrlRef,
      navigate,
    ]
  );

  return { handleOptimize };
}
