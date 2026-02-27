import OptimizationConfig from '@config/OptimizationConfig';
import { throwIfAborted } from './abort';
import type { OptimizeFlowArgs } from './types';

export const runOptimizeFlow = async ({
  request,
  log,
  optimizationCache,
  shotInterpreter,
  strategyFactory,
  qualityAssessment,
  compilationService,
  optimizeIteratively,
  applyConstitutionalAI,
  logOptimizationMetrics,
  metricsService,
}: OptimizeFlowArgs) => {
  const startTime = performance.now();
  const operation = 'optimize';

  const {
    prompt,
    mode: _mode,
    context = null,
    brainstormContext = null,
    generationParams = null,
    skipCache = false,
    lockedSpans = [],
    shotPlan = null,
    shotPlanAttempted = false,
    useConstitutionalAI = false,
    useIterativeRefinement = false,
    onMetadata,
    onChunk,
    signal,
    targetModel,
  } = request;
  void _mode;

  const finalMode = 'video' as const;

  log.debug('Starting operation.', {
    operation,
    mode: finalMode,
    promptLength: prompt.length,
    hasContext: !!context,
    hasBrainstormContext: !!brainstormContext,
    hasGenerationParams: !!generationParams,
    hasShotPlan: !!shotPlan,
    shotPlanAttempted,
    useConstitutionalAI,
    useIterativeRefinement,
    skipCache,
    lockedSpanCount: lockedSpans.length,
  });

  throwIfAborted(signal);

  const cacheKey = optimizationCache.buildCacheKey(
    prompt,
    finalMode,
    context,
    brainstormContext,
    targetModel,
    generationParams,
    lockedSpans
  );

  if (!skipCache) {
    const cached = await optimizationCache.getCachedResult(cacheKey);
    if (cached) {
      const cachedMetadata = await optimizationCache.getCachedMetadata(cacheKey);
      if (onMetadata && cachedMetadata) {
        onMetadata(cachedMetadata);
      }
      log.debug('Returning cached optimization result', {
        operation,
        mode: finalMode,
        duration: Math.round(performance.now() - startTime),
      });
      return {
        prompt: cached,
        inputMode: 't2v' as const,
        ...(cachedMetadata ? { metadata: cachedMetadata } : {}),
      };
    }
  } else {
    log.debug('Skipping optimization cache', {
      operation,
      mode: finalMode,
    });
  }

  let interpretedShotPlan = shotPlan;
  if (!interpretedShotPlan && !shotPlanAttempted) {
    try {
      throwIfAborted(signal);
      interpretedShotPlan = await shotInterpreter.interpret(prompt, signal);
    } catch (interpError) {
      log.warn('Shot interpretation (single-stage) failed, proceeding without plan', {
        operation,
        error: (interpError as Error).message,
      });
    }
  }

  try {
    let optimizedPrompt: string;
    let optimizationMetadata: Record<string, unknown> | null = null;
    const handleMetadata = (metadata: Record<string, unknown>): void => {
      optimizationMetadata = { ...(optimizationMetadata || {}), ...metadata };
      if (onMetadata) {
        onMetadata(metadata);
      }
    };

    if (useIterativeRefinement) {
      optimizedPrompt = await optimizeIteratively(
        prompt,
        finalMode,
        context,
        brainstormContext,
        lockedSpans,
        generationParams,
        interpretedShotPlan,
        useConstitutionalAI,
        signal,
        handleMetadata
      );
    } else {
      const strategy = strategyFactory.getStrategy(finalMode);

      const domainContent = strategy.generateDomainContent
        ? await strategy.generateDomainContent(prompt, context || null, interpretedShotPlan)
        : null;

      optimizedPrompt = await strategy.optimize({
        prompt,
        context,
        brainstormContext,
        generationParams,
        domainContent: domainContent as string | null,
        shotPlan: interpretedShotPlan,
        lockedSpans,
        onMetadata: handleMetadata,
        ...(onChunk ? { onChunk } : {}),
        ...(signal ? { signal } : {}),
      });

      if (useConstitutionalAI) {
        optimizedPrompt = await applyConstitutionalAI(optimizedPrompt, finalMode, signal);
      }
    }

    let qualityAssessmentResult = await qualityAssessment.assessQuality(optimizedPrompt, finalMode);
    const qualityThreshold = OptimizationConfig.quality.minAcceptableScore;

    handleMetadata({
      qualityAssessment: qualityAssessmentResult,
    });

    const qualityGateTriggered = !useIterativeRefinement && qualityAssessmentResult.score < qualityThreshold;
    metricsService?.recordOptimizationQualityGate(qualityAssessmentResult.score, qualityGateTriggered);

    if (qualityGateTriggered) {
      const initialScore = qualityAssessmentResult.score;
      log.warn('Quality gate failed, attempting bounded refinement', {
        operation,
        score: initialScore,
        threshold: qualityThreshold,
      });

      optimizedPrompt = await optimizeIteratively(
        prompt,
        finalMode,
        context,
        brainstormContext,
        lockedSpans,
        generationParams,
        interpretedShotPlan,
        useConstitutionalAI,
        signal,
        handleMetadata
      );

      qualityAssessmentResult = await qualityAssessment.assessQuality(optimizedPrompt, finalMode);
      handleMetadata({
        qualityAssessment: qualityAssessmentResult,
        qualityGate: {
          triggered: true,
          initialScore,
          finalScore: qualityAssessmentResult.score,
        },
      });
    }

    handleMetadata({ genericPrompt: optimizedPrompt });

    if (finalMode === 'video' && compilationService) {
      const compilation = await compilationService.compileOptimizedPrompt({
        operation,
        optimizedPrompt,
        mode: finalMode,
        qualityAssessment: qualityAssessmentResult,
        ...(targetModel !== undefined ? { targetModel } : {}),
      });

      optimizedPrompt = compilation.prompt;
      if (compilation.metadata) {
        handleMetadata(compilation.metadata);
      }
    }

    await optimizationCache.cacheResult(cacheKey, optimizedPrompt, optimizationMetadata);
    logOptimizationMetrics(prompt, optimizedPrompt, finalMode);

    log.info('Operation completed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: finalMode,
      inputLength: prompt.length,
      outputLength: optimizedPrompt.length,
      useConstitutionalAI,
      useIterativeRefinement,
    });

    return {
      prompt: optimizedPrompt,
      inputMode: 't2v' as const,
      ...(optimizationMetadata ? { metadata: optimizationMetadata } : {}),
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      log.info('Operation aborted.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
      });
      throw error;
    }
    log.error('Operation failed.', error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: finalMode,
      promptLength: prompt.length,
    });
    throw error;
  }
};
