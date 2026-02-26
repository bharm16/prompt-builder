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

  if (!draftService.supportsStreaming()) {
    throw new Error('Two-stage optimization unavailable: draft streaming not supported');
  }

  try {
    const draftStartTime = performance.now();

    throwIfAborted(signal);

    // Run shot interpretation in parallel with draft generation.
    // The shot plan is optional — if interpretation is slower than drafting
    // or fails, the draft proceeds without it. The shot plan still reaches
    // the refinement stage where it has more structural impact.
    const [shotPlanResult, draft] = await Promise.all([
      shotInterpreter.interpret(prompt, signal).catch((interpError: unknown) => {
        log.warn('Shot interpretation failed, proceeding without shot plan', {
          operation,
          error: (interpError as Error).message,
        });
        return null;
      }),
      draftService.generateDraft(
        prompt,
        finalMode,
        null,
        generationParams,
        signal,
        onDraftChunk ? (delta) => onDraftChunk(delta) : undefined
      ),
    ]);
    const shotPlan = shotPlanResult;

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
    log.error('Two-stage optimization failed', error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
      mode: finalMode,
    });

    const cause = error as Error;
    const wrapped = new Error(`Two-stage optimization failed: ${cause.message}`);
    wrapped.cause = cause;
    throw wrapped;
  }
};
