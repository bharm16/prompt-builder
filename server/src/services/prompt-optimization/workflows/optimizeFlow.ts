import { throwIfAborted } from "./abort";
import { applyIntentLockPolicy } from "../services/intentLockPolicy";
import type { CompilationState } from "../types";
import type { OptimizationResponse } from "../types";
import type { OptimizeFlowArgs } from "./types";

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
  telemetry: t,
}: OptimizeFlowArgs): Promise<OptimizationResponse> => {
  const startTime = performance.now();
  const operation = "optimize";

  const {
    prompt,
    mode = "video",
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

  const inputSummary = {
    promptLength: prompt.length,
    lockedSpanCount: lockedSpans.length,
    targetModel: targetModel ?? null,
    mode: mode as "video",
    hasContext: !!context,
    hasBrainstormContext: !!brainstormContext,
    hasShotPlan: !!shotPlan,
    useConstitutionalAI: !!useConstitutionalAI,
    inputPrompt: prompt,
  };

  const originalUserPrompt =
    typeof brainstormContext?.originalUserPrompt === "string" &&
    brainstormContext.originalUserPrompt.trim().length > 0
      ? brainstormContext.originalUserPrompt.trim()
      : prompt;

  log.debug("Starting operation.", {
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
    lockedSpans,
  );

  if (!skipCache) {
    const [cached, cachedMetadata] = await Promise.all([
      optimizationCache.getCachedResult(cacheKey),
      optimizationCache.getCachedMetadata(cacheKey),
    ]);
    if (cached) {
      if (onMetadata && cachedMetadata) {
        onMetadata(cachedMetadata);
      }
      log.debug("Returning cached optimization result", {
        operation,
        mode: mode,
        duration: Math.round(performance.now() - startTime),
      });
      t.recordCacheHit();
      t.complete({
        outcome: "success",
        outputLength: cached.length,
        outputPrompt: cached,
        ...inputSummary,
      });
      return {
        prompt: cached,
        ...(typeof cachedMetadata?.artifactKey === "string"
          ? { artifactKey: cachedMetadata.artifactKey }
          : {}),
        ...(cachedMetadata?.compilation &&
        typeof cachedMetadata.compilation === "object"
          ? { compilation: cachedMetadata.compilation as CompilationState }
          : {}),
        ...(cachedMetadata ? { metadata: cachedMetadata } : {}),
      };
    }
  } else {
    log.debug("Skipping optimization cache", {
      operation,
      mode: mode,
    });
  }

  let interpretedShotPlan = shotPlan;
  if (!interpretedShotPlan && !shotPlanAttempted) {
    const shotStart = performance.now();
    try {
      throwIfAborted(signal);
      interpretedShotPlan = await shotInterpreter.interpret(prompt, signal);
      t.recordLlmCall();
    } catch (interpError) {
      log.warn(
        "Shot interpretation (single-stage) failed, proceeding without plan",
        {
          operation,
          error: (interpError as Error).message,
        },
      );
    } finally {
      t.recordStage("shot_interpreter", performance.now() - shotStart);
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
          status: "compile-skipped",
          usedFallback: false,
          sourceKind: structuredArtifact ? "artifact" : "prompt",
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
      ? await strategy.generateDomainContent(
          prompt,
          context || null,
          interpretedShotPlan,
        )
      : null;
    if (strategy.generateDomainContent) {
      t.recordLlmCall();
    }
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

    const strategyStart = performance.now();
    try {
      if (
        mode === "video" &&
        strategy.optimizeStructured &&
        strategy.renderStructuredPrompt
      ) {
        structuredArtifact = await strategy.optimizeStructured(strategyRequest);
        t.recordLlmCall();
        artifactKey = optimizationCache.buildStructuredArtifactKeyFromInputs({
          prompt,
          sourcePrompt: structuredArtifact.sourcePrompt,
          shotPlan: interpretedShotPlan,
          generationParams,
          lockedSpans,
        });
        await optimizationCache.cacheStructuredArtifact(
          artifactKey,
          structuredArtifact,
        );
        handleMetadata({
          previewPrompt: structuredArtifact.previewPrompt,
          ...(structuredArtifact.aspectRatio
            ? { aspectRatio: structuredArtifact.aspectRatio }
            : {}),
          artifactKey,
        });
        if (!targetModel) {
          compilationState = {
            status: "compile-skipped",
            usedFallback: false,
            sourceKind: "artifact",
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
        optimizedPrompt = strategy.renderStructuredPrompt(
          structuredArtifact.structuredPrompt,
        );
      } else {
        optimizedPrompt = await strategy.optimize({
          ...strategyRequest,
          onMetadata: handleMetadata,
        });
        t.recordLlmCall();
      }
    } catch (err) {
      t.recordError("strategy", err);
      throw err;
    } finally {
      t.recordStage("strategy", performance.now() - strategyStart);
    }

    if (useConstitutionalAI) {
      const constitutionalStart = performance.now();
      try {
        optimizedPrompt = await applyConstitutionalAI(
          optimizedPrompt,
          mode,
          signal,
        );
        t.recordLlmCall();
      } catch (err) {
        t.recordError("constitutional", err);
        throw err;
      } finally {
        t.recordStage(
          "constitutional",
          performance.now() - constitutionalStart,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: Enforce intent lock on the generic prompt (full repair)
    // This runs BEFORE compilation so the generic prompt preserves user intent,
    // and compilation receives an intent-correct input.
    // -----------------------------------------------------------------------
    const intentStart = performance.now();
    const intentLocked = applyIntentLockPolicy({
      intentLock,
      originalPrompt: originalUserPrompt,
      optimizedPrompt,
      shotPlan: interpretedShotPlan,
    });
    t.recordStage("intent_lock", performance.now() - intentStart);
    optimizedPrompt = intentLocked.prompt;
    handleMetadata(intentLocked.legacyMetadata);

    // -----------------------------------------------------------------------
    // Step 3: Compile for target model (if requested)
    // Compilation receives the intent-locked generic prompt.
    // -----------------------------------------------------------------------
    if (targetModel && mode === "video" && compilationService) {
      const compilationStart = performance.now();
      try {
        const compilation = await compilationService.compile({
          operation,
          mode: mode,
          ...(targetModel !== undefined ? { targetModel } : {}),
          source: structuredArtifact
            ? { kind: "artifact", artifact: structuredArtifact }
            : { kind: "prompt", prompt: optimizedPrompt },
          fallbackPrompt: optimizedPrompt,
          ...(artifactKey ? { artifactKey } : {}),
        });
        t.recordLlmCall();

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
            log.warn(
              "Post-compilation intent validation failed (not repaired)",
              {
                operation,
                targetModel,
                required: postCompileCheck.required,
              },
            );
          }
          compilationState = {
            ...compilationState,
            intentLock: {
              passed: postCompileCheck.passed,
              repaired: false,
              skippedRepair: !postCompileCheck.passed,
              required: postCompileCheck.required,
              ...(!postCompileCheck.passed
                ? {
                    warning:
                      "Intent lock requested a repair, but repair was skipped to preserve model-specific output structure.",
                  }
                : {}),
            },
          };
        }
      } catch (err) {
        t.recordError("compilation", err);
        throw err;
      } finally {
        t.recordStage("compilation", performance.now() - compilationStart);
      }
    }

    if (compilationState) {
      handleMetadata({ compilation: compilationState });
    }

    // -----------------------------------------------------------------------
    // Step 4: Prompt lint gate (runs last — repairs formatting issues)
    // -----------------------------------------------------------------------
    const lintStart = performance.now();
    const lintResult = promptLint.enforce({
      prompt: optimizedPrompt,
      modelId: targetModel ?? null,
    });
    t.recordStage("prompt_lint", performance.now() - lintStart);
    optimizedPrompt = lintResult.prompt;
    handleMetadata({
      promptLint: lintResult.lint,
      promptLintRepaired: lintResult.repaired,
    });

    if (!targetModel) {
      handleMetadata({ genericPrompt: optimizedPrompt });
    }

    void optimizationCache
      .cacheResult(cacheKey, optimizedPrompt, optimizationMetadata)
      .catch((err) => {
        // Stable event tag — alerting hooks off this so operators retain the
        // back-pressure signal that the previous awaited write produced.
        log.warn("Failed to write optimization result to cache", {
          event: "optimization_cache_write_failed",
          operation,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    logOptimizationMetrics(prompt, optimizedPrompt, mode);

    log.info("Operation completed.", {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: mode,
      inputLength: prompt.length,
      outputLength: optimizedPrompt.length,
      useConstitutionalAI,
    });

    t.complete({
      outcome: "success",
      outputLength: optimizedPrompt.length,
      outputPrompt: optimizedPrompt,
      ...inputSummary,
    });

    return {
      prompt: optimizedPrompt,
      ...(artifactKey ? { artifactKey } : {}),
      ...(compilationState ? { compilation: compilationState } : {}),
      ...(optimizationMetadata ? { metadata: optimizationMetadata } : {}),
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      t.complete({
        outcome: "aborted",
        outputLength: 0,
        outputPrompt: null,
        ...inputSummary,
      });
      log.info("Operation aborted.", {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: mode,
      });
      throw error;
    }
    t.complete({
      outcome: "error",
      outputLength: 0,
      outputPrompt: null,
      ...inputSummary,
    });
    log.error("Operation failed.", error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: mode,
      promptLength: prompt.length,
    });
    throw error;
  }
};
