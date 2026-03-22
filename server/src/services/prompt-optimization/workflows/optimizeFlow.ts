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
  strategy,
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
    mode = 'video',
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

  const originalUserPrompt =
    typeof brainstormContext?.originalUserPrompt === 'string' &&
    brainstormContext.originalUserPrompt.trim().length > 0
      ? brainstormContext.originalUserPrompt.trim()
      : prompt;

  log.debug('Starting operation.', {
    operation,
    mode: mode,
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
    mode,
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
        mode: mode,
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
      mode: mode,
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

    if (mode === 'video' && strategy.optimizeStructured && strategy.renderStructuredPrompt) {
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

    // -----------------------------------------------------------------------
    // Step 1: Resolve generic optimized prompt (before compilation)
    // -----------------------------------------------------------------------
    if (structuredArtifact && strategy.renderStructuredPrompt) {
      optimizedPrompt = strategy.renderStructuredPrompt(structuredArtifact.structuredPrompt);
    } else {
      optimizedPrompt = await strategy.optimize({
        ...strategyRequest,
        onMetadata: handleMetadata,
      });
    }

    if (useConstitutionalAI) {
      optimizedPrompt = await applyConstitutionalAI(optimizedPrompt, mode, signal);
    }

    // -----------------------------------------------------------------------
    // Step 2: Enforce intent lock on the generic prompt (full repair)
    // This runs BEFORE compilation so the generic prompt preserves user intent,
    // and compilation receives an intent-correct input.
    // -----------------------------------------------------------------------
    const intentLocked = applyIntentLockPolicy({
      intentLock,
      originalPrompt: originalUserPrompt,
      optimizedPrompt,
      shotPlan: interpretedShotPlan,
    });
    optimizedPrompt = intentLocked.prompt;
    handleMetadata(intentLocked.legacyMetadata);

    // -----------------------------------------------------------------------
    // Step 3: Compile for target model (if requested)
    // Compilation receives the intent-locked generic prompt.
    // -----------------------------------------------------------------------
    if (targetModel && mode === 'video' && compilationService) {
      const compilation = await compilationService.compile({
        operation,
        mode: mode,
        ...(targetModel !== undefined ? { targetModel } : {}),
        source: structuredArtifact
          ? { kind: 'artifact', artifact: structuredArtifact }
          : { kind: 'prompt', prompt: optimizedPrompt },
        fallbackPrompt: optimizedPrompt,
        ...(artifactKey ? { artifactKey } : {}),
      });

      optimizedPrompt = compilation.prompt;
      compilationState = compilation.compilation;
      if (compilation.metadata) {
        handleMetadata(compilation.metadata);
      }

      // Post-compilation validate-only intent check — warn but don't mutate.
      if (intentLock.validateIntentPreservation) {
        const postCompileCheck = intentLock.validateIntentPreservation({
          originalPrompt: originalUserPrompt,
          optimizedPrompt,
          shotPlan: interpretedShotPlan,
        });
        if (!postCompileCheck.passed) {
          log.warn('Post-compilation intent validation failed (not repaired)', {
            operation,
            targetModel,
            required: postCompileCheck.required,
          });
        }
        compilationState = {
          ...compilationState,
          intentLock: {
            passed: postCompileCheck.passed,
            repaired: false,
            skippedRepair: !postCompileCheck.passed,
            required: postCompileCheck.required,
            ...(!postCompileCheck.passed
              ? { warning: 'Intent lock requested a repair, but repair was skipped to preserve model-specific output structure.' }
              : {}),
          },
        };
      }
    }

    if (compilationState) {
      handleMetadata({ compilation: compilationState });
    }

    // -----------------------------------------------------------------------
    // Step 4: Prompt lint gate (runs last — repairs formatting issues)
    // -----------------------------------------------------------------------
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
    logOptimizationMetrics(prompt, optimizedPrompt, mode);

    log.info('Operation completed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: mode,
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
        mode: mode,
      });
      throw error;
    }
    log.error('Operation failed.', error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: mode,
      promptLength: prompt.length,
    });
    throw error;
  }
};
