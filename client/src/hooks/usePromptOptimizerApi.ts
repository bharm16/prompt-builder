import { useCallback } from 'react';

import { promptOptimizationApiV2 } from '../services';
import { logger } from '../services/LoggingService';

export type AnalyzeAndOptimizeOptions = Omit<
  Parameters<typeof promptOptimizationApiV2.optimizeLegacy>[0],
  'mode'
>;

export type OptimizeWithFallbackOptions = Omit<
  Parameters<typeof promptOptimizationApiV2.optimizeWithFallback>[0],
  'mode'
>;

export type CompilePromptOptions = Parameters<typeof promptOptimizationApiV2.compilePrompt>[0];

export function usePromptOptimizerApi(
  selectedMode: string,
  log: ReturnType<typeof logger.child>
) {
  const analyzeAndOptimize = useCallback(
    async ({
      prompt,
      targetModel,
      context = null,
      brainstormContext = null,
      generationParams,
      skipCache,
      lockedSpans,
      signal,
    }: AnalyzeAndOptimizeOptions) => {
      log.debug('analyzeAndOptimize called', {
        promptLength: prompt.length,
        mode: selectedMode,
        targetModel,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
        generationParamCount: generationParams ? Object.keys(generationParams).length : 0,
        skipCache: !!skipCache,
        lockedSpanCount: lockedSpans?.length ?? 0,
      });
      logger.startTimer('analyzeAndOptimize');

      try {
        const data = await promptOptimizationApiV2.optimizeLegacy({
          prompt,
          mode: selectedMode,
          ...(targetModel ? { targetModel } : {}),
          context,
          brainstormContext,
          ...(generationParams ? { generationParams } : {}),
          ...(skipCache ? { skipCache } : {}),
          ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
          ...(signal ? { signal } : {}),
        });

        const duration = logger.endTimer('analyzeAndOptimize');
        log.info('analyzeAndOptimize completed', {
          duration,
          outputLength: data.optimizedPrompt?.length || 0,
        });

        return data;
      } catch (error) {
        logger.endTimer('analyzeAndOptimize');
        log.error('analyzeAndOptimize failed', error as Error);
        throw error;
      }
    },
    [selectedMode, log]
  );

  const optimizeWithFallback = useCallback(
    (options: OptimizeWithFallbackOptions) =>
      promptOptimizationApiV2.optimizeWithFallback({
        ...options,
        mode: selectedMode,
      }),
    [selectedMode]
  );

  const calculateQualityScore = useCallback(
    (inputPrompt: string, outputPrompt: string) =>
      promptOptimizationApiV2.calculateQualityScore(inputPrompt, outputPrompt),
    []
  );

  return {
    analyzeAndOptimize,
    optimizeWithFallback,
    compilePrompt: promptOptimizationApiV2.compilePrompt.bind(promptOptimizationApiV2),
    calculateQualityScore,
  };
}
