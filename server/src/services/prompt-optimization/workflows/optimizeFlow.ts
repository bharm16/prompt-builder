import { throwIfAborted } from './abort';
import { applyIntentLockPolicy } from '../services/intentLockPolicy';
import type { CompilationState } from '../types';
import type { OptimizationResponse } from '../types';
import type { OptimizeFlowArgs } from './types';

export const runOptimizeFlow = async ({
  request,
  log,
  optimizationCache,
  shotInterpreter,
  strategyFactory,
  compilationService,
  applyConstitutionalAI,
  logOptimizationMetrics,
  intentLock,
  promptLint,
}: OptimizeFlowArgs): Promise<OptimizationResponse> => {
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
    onMetadata,
    signal,
    targetModel,
  } = request;
  void _mode;

  const originalUserPrompt =
    typeof brainstormContext?.originalUserPrompt === 'string' &&
    brainstormContext.originalUserPrompt.trim().length > 0
      ? brainstormContext.originalUserPrompt.trim()
      : prompt;

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
        ...(typeof cachedMetadata?.artifactKey === 'string'
          ? { artifactKey: cachedMetadata.artifactKey }
          : {}),
        ...(cachedMetadata?.compilation && typeof cachedMetadata.compilation === 'object'
          ? { compilation: cachedMetadata.compilation as CompilationState }
          : {}),
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
    let structuredArtifact = null;
    let artifactKey: string | null = null;
    let compilationState: CompilationState | null = targetModel
      ? null
      : {
          status: 'compile-skipped',
          usedFallback: false,
          sourceKind: structuredArtifact ? 'artifact' : 'prompt',
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: null,
        };
    const handleMetadata = (metadata: Record<string, unknown>): void => {
      optimizationMetadata = { ...(optimizationMetadata || {}), ...metadata };
      if (onMetadata) {
        onMetadata(metadata);
      }
    };
    if (targetModel) {
      handleMetadata({ normalizedModelId: targetModel });
    }

    const strategy = strategyFactory.getStrategy(finalMode);

    const domainContent = strategy.generateDomainContent
      ? await strategy.generateDomainContent(prompt, context || null, interpretedShotPlan)
      : null;
    const strategyRequest = {
      prompt,
      context,
      brainstormContext,
      generationParams,
      domainContent: domainContent as string | null,
      shotPlan: interpretedShotPlan,
      lockedSpans,
      ...(signal ? { signal } : {}),
    };

    if (finalMode === 'video' && strategy.optimizeStructured && strategy.renderStructuredPrompt) {
      structuredArtifact = await strategy.optimizeStructured(strategyRequest);
      artifactKey = optimizationCache.buildStructuredArtifactKeyFromInputs({
        prompt,
        sourcePrompt: structuredArtifact.sourcePrompt,
        shotPlan: interpretedShotPlan,
        generationParams,
        lockedSpans,
      });
      await optimizationCache.cacheStructuredArtifact(artifactKey, structuredArtifact);
      handleMetadata({
        previewPrompt: structuredArtifact.previewPrompt,
        ...(structuredArtifact.aspectRatio ? { aspectRatio: structuredArtifact.aspectRatio } : {}),
        artifactKey,
      });
      if (!targetModel) {
        compilationState = {
          status: 'compile-skipped',
          usedFallback: false,
          sourceKind: 'artifact',
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: null,
        };
      }
    }

    if (targetModel && finalMode === 'video' && compilationService) {
      const compilation = await compilationService.compile({
        operation,
        mode: finalMode,
        ...(targetModel !== undefined ? { targetModel } : {}),
        source: structuredArtifact
          ? { kind: 'artifact', artifact: structuredArtifact }
          : { kind: 'prompt', prompt },
        fallbackPrompt: prompt,
        ...(artifactKey ? { artifactKey } : {}),
      });

      optimizedPrompt = compilation.prompt;
      compilationState = compilation.compilation;
      if (compilation.metadata) {
        handleMetadata(compilation.metadata);
      }
    } else if (structuredArtifact && strategy.renderStructuredPrompt) {
      optimizedPrompt = strategy.renderStructuredPrompt(structuredArtifact.structuredPrompt);
    } else {
      optimizedPrompt = await strategy.optimize({
        ...strategyRequest,
        onMetadata: handleMetadata,
      });
    }

    if (useConstitutionalAI) {
      optimizedPrompt = await applyConstitutionalAI(optimizedPrompt, finalMode, signal);
    }

    const intentLocked = applyIntentLockPolicy({
      intentLock,
      originalPrompt: originalUserPrompt,
      optimizedPrompt,
      shotPlan: interpretedShotPlan,
      compilation: compilationState,
    });
    optimizedPrompt = intentLocked.prompt;
    if (compilationState) {
      compilationState = {
        ...compilationState,
        ...(intentLocked.compilationIntentLock
          ? { intentLock: intentLocked.compilationIntentLock }
          : {}),
      };
    }
    handleMetadata({
      ...intentLocked.legacyMetadata,
      ...(compilationState ? { compilation: compilationState } : {}),
    });

    const lintResult = promptLint.enforce({
      prompt: optimizedPrompt,
      modelId: targetModel ?? null,
    });
    optimizedPrompt = lintResult.prompt;
    handleMetadata({
      promptLint: lintResult.lint,
      promptLintRepaired: lintResult.repaired,
    });

    if (!targetModel) {
      handleMetadata({ genericPrompt: optimizedPrompt });
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
    });

    return {
      prompt: optimizedPrompt,
      inputMode: 't2v' as const,
      ...(artifactKey ? { artifactKey } : {}),
      ...(compilationState ? { compilation: compilationState } : {}),
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
