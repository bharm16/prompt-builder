import type { OptimizationRequest } from '../types';
import { throwIfAborted } from './abort';
import type { TwoStageFlowArgs, TwoStageResult } from './types';

export const runTwoStageFlow = async ({
  request,
  log,
  shotInterpreter,
  draftService,
  optimize,
}: TwoStageFlowArgs): TwoStageResult => {
  const startTime = performance.now();
  const operation = 'optimizeTwoStage';

  const {
    prompt,
    mode: _mode,
    targetModel,
    context = null,
    brainstormContext = null,
    generationParams = null,
    skipCache = false,
    lockedSpans = [],
    onDraft = null,
    onDraftChunk = null,
    onRefinedChunk = null,
    signal,
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
    skipCache,
    lockedSpanCount: lockedSpans.length,
  });

  throwIfAborted(signal);

  let shotPlan = null;
  try {
    shotPlan = await shotInterpreter.interpret(prompt, signal);
  } catch (interpError) {
    log.warn('Shot interpretation failed, proceeding without shot plan', {
      operation,
      error: (interpError as Error).message,
    });
  }

  throwIfAborted(signal);

  if (!draftService.supportsStreaming()) {
    log.warn('Draft streaming not available, falling back to single-stage optimization', {
      operation,
    });
    let fallbackMetadata: Record<string, unknown> | null = null;
    const result = await optimize({
      prompt,
      mode: finalMode,
      ...(targetModel ? { targetModel } : {}),
      context,
      brainstormContext,
      generationParams,
      skipCache,
      lockedSpans,
      onMetadata: (metadata) => {
        fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
      },
      ...(signal ? { signal } : {}),
    });
    const fallbackPrompt = result.prompt;
    return {
      draft: fallbackPrompt,
      refined: fallbackPrompt,
      metadata: { usedFallback: true, ...(fallbackMetadata || result.metadata || {}) },
    };
  }

  try {
    const draftStartTime = performance.now();

    throwIfAborted(signal);

    const draft = await draftService.generateDraft(
      prompt,
      finalMode,
      shotPlan,
      generationParams,
      signal,
      onDraftChunk ? (delta) => onDraftChunk(delta) : undefined
    );

    const draftDuration = Math.round(performance.now() - draftStartTime);

    log.info('Draft generated successfully', {
      operation,
      duration: draftDuration,
      draftLength: draft.length,
      mode: finalMode,
    });

    if (onDraft && typeof onDraft === 'function') {
      onDraft(draft, null);
    }

    log.debug('Starting refinement with primary model', {
      operation,
      mode: finalMode,
    });
    const refinementStartTime = performance.now();

    throwIfAborted(signal);

    let refinementMetadata: Record<string, unknown> | null = null;
    const refinedResult = await optimize({
      prompt: draft,
      mode: finalMode,
      ...(targetModel ? { targetModel } : {}),
      context,
      brainstormContext: {
        ...(brainstormContext || {}),
        originalUserPrompt: prompt,
      },
      generationParams,
      skipCache,
      lockedSpans,
      shotPlan,
      shotPlanAttempted: true,
      onMetadata: (metadata) => {
        refinementMetadata = { ...(refinementMetadata || {}), ...metadata };
      },
      ...(onRefinedChunk ? { onChunk: (delta: string) => onRefinedChunk(delta) } : {}),
      ...(signal ? { signal } : {}),
    } as OptimizationRequest);
    const refinedPrompt = refinedResult.prompt;

    const refinementDuration = Math.round(performance.now() - refinementStartTime);
    const totalDuration = Math.round(performance.now() - startTime);

    log.info('Two-stage optimization complete', {
      operation,
      draftDuration,
      refinementDuration,
      totalDuration,
      mode: finalMode,
      draftLength: draft.length,
      refinedLength: refinedPrompt.length,
    });

    return {
      draft,
      refined: refinedPrompt,
      draftSpans: null,
      refinedSpans: null,
      metadata: {
        draftDuration,
        refinementDuration,
        totalDuration,
        mode: finalMode,
        usedTwoStage: true,
        shotPlan,
        ...(refinementMetadata || {}),
      },
    };
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      log.info('Two-stage optimization aborted', {
        operation,
        duration: Math.round(performance.now() - startTime),
        mode: finalMode,
      });
      throw error;
    }
    log.error('Two-stage optimization failed, falling back to single-stage', error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: finalMode,
    });

    let fallbackMetadata: Record<string, unknown> | null = null;
    const result = await optimize({
      prompt,
      mode: finalMode,
      ...(targetModel ? { targetModel } : {}),
      context,
      brainstormContext,
      generationParams,
      skipCache,
      lockedSpans,
      shotPlan,
      shotPlanAttempted: true,
      onMetadata: (metadata) => {
        fallbackMetadata = { ...(fallbackMetadata || {}), ...metadata };
      },
      ...(signal ? { signal } : {}),
    });
    const fallbackPrompt = result.prompt;
    return {
      draft: fallbackPrompt,
      refined: fallbackPrompt,
      metadata: {
        mode: finalMode,
        usedFallback: true,
        shotPlan,
        ...(fallbackMetadata || {}),
      },
      usedFallback: true,
      error: (error as Error).message,
    };
  }
};
