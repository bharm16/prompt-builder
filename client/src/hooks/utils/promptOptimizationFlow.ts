import type { MutableRefObject } from 'react';

import { logger } from '../../services/LoggingService';
import {
  markDraftReady,
  markRefinementComplete,
  markSpansReceived,
  measureDraftToRefined,
  measureOptimizeToDraft,
  measureOptimizeToRefinedTotal,
} from './performanceMetrics';
import type { SpansData } from '../usePromptOptimizerState';
import type { Toast } from '../types';
import type { LockedSpan } from '@/features/prompt-optimizer/types';
import type { CapabilityValues } from '@shared/capabilities';

export interface PromptOptimizerActions {
  setDraftPrompt: (prompt: string) => void;
  setOptimizedPrompt: (prompt: string) => void;
  setDisplayedPrompt: (prompt: string) => void;
  setGenericOptimizedPrompt: (prompt: string | null) => void;
  setIsDraftReady: (ready: boolean) => void;
  setIsRefining: (refining: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  setDraftSpans: (spans: SpansData | null) => void;
  setRefinedSpans: (spans: SpansData | null) => void;
  setQualityScore: (score: number | null) => void;
  setPreviewPrompt: (prompt: string | null) => void;
  setPreviewAspectRatio: (ratio: string | null) => void;
}

export interface OptimizationOutcome {
  optimized: string;
  score: number;
}

type OptimizeWithFallback = (options: {
  prompt: string;
  mode: string;
  targetModel?: string;
  context?: unknown | null;
  brainstormContext?: unknown | null;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  signal: AbortSignal;
  onDraft?: (draft: string) => void;
  onSpans?: (spans: unknown[], source: string, meta?: unknown) => void;
  onRefined?: (refined: string, metadata?: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}) => Promise<{
  refined: string;
  metadata?: Record<string, unknown> | null;
  usedFallback?: boolean;
}>;

type AnalyzeAndOptimize = (options: {
  prompt: string;
  targetModel?: string;
  context?: unknown | null;
  brainstormContext?: unknown | null;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  signal?: AbortSignal;
}) => Promise<{ optimizedPrompt: string; metadata?: Record<string, unknown> }>;

function normalizeSpans(spans: unknown[]): SpansData['spans'] {
  if (!Array.isArray(spans)) {
    return [];
  }

  return spans.filter((span): span is SpansData['spans'][number] => {
    if (!span || typeof span !== 'object') {
      return false;
    }
    const candidate = span as {
      start?: unknown;
      end?: unknown;
      category?: unknown;
      confidence?: unknown;
    };
    return (
      typeof candidate.start === 'number' &&
      typeof candidate.end === 'number' &&
      typeof candidate.category === 'string' &&
      typeof candidate.confidence === 'number'
    );
  });
}

export interface TwoStageOptimizationOptions {
  promptToOptimize: string;
  selectedMode: string;
  selectedModel?: string;
  context: unknown | null;
  brainstormContext: unknown | null;
  generationParams?: CapabilityValues;
  abortController: AbortController;
  skipCache?: boolean;
  requestId: number;
  requestIdRef: MutableRefObject<number>;
  refinedSpans: SpansData | null;
  lockedSpans?: LockedSpan[];
  actions: PromptOptimizerActions;
  toast: Toast;
  log: ReturnType<typeof logger.child>;
  optimizeWithFallback: OptimizeWithFallback;
  calculateQualityScore: (inputPrompt: string, outputPrompt: string) => number;
}

export async function runTwoStageOptimization({
  promptToOptimize,
  selectedMode,
  selectedModel,
  context,
  brainstormContext,
  generationParams,
  abortController,
  skipCache,
  requestId,
  requestIdRef,
  refinedSpans,
  lockedSpans,
  actions,
  toast,
  log,
  optimizeWithFallback,
  calculateQualityScore,
}: TwoStageOptimizationOptions): Promise<OptimizationOutcome | null> {
  log.debug('Starting two-stage optimization', {
    operation: 'optimize',
    stage: 'two-stage',
  });

  const result = await optimizeWithFallback({
    prompt: promptToOptimize,
    mode: selectedMode,
    ...(selectedModel ? { targetModel: selectedModel } : {}),
    context,
    brainstormContext,
    ...(generationParams ? { generationParams } : {}),
    ...(skipCache ? { skipCache } : {}),
    ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
    signal: abortController.signal,
    onDraft: (draft: string) => {
      if (abortController.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      const draftDuration = logger.endTimer('optimize');
      logger.startTimer('optimize');

      markDraftReady();
      measureOptimizeToDraft();

      log.debug('Draft callback triggered', {
        operation: 'optimize',
        stage: 'draft',
        draftLength: draft.length,
        duration: draftDuration,
      });

      actions.setDraftPrompt(draft);
      actions.setOptimizedPrompt(draft);
      actions.setDisplayedPrompt(draft);
      actions.setIsDraftReady(true);
      actions.setIsRefining(true);
      actions.setIsProcessing(false);

      const draftScore = calculateQualityScore(promptToOptimize, draft);
      actions.setQualityScore(draftScore);

      log.info('Draft ready', {
        operation: 'optimize',
        stage: 'draft',
        duration: draftDuration,
        score: draftScore,
        outputLength: draft.length,
      });

      toast.info('Draft ready! Refining in background...');
    },
    onSpans: (spans: unknown[], source: string, meta?: unknown) => {
      if (abortController.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      markSpansReceived(source);

      log.debug('Spans callback triggered', {
        operation: 'optimize',
        stage: source,
        spanCount: Array.isArray(spans) ? spans.length : 0,
        hasMeta: !!meta,
      });

      const normalizedSpans = normalizeSpans(spans);

      const spansData: SpansData = {
        spans: normalizedSpans,
        meta: (meta as Record<string, unknown>) || null,
        source,
        timestamp: Date.now(),
      };

      if (source === 'draft') {
        actions.setDraftSpans(spansData);
        log.debug('Draft spans stored', {
          operation: 'optimize',
          spanCount: normalizedSpans.length,
          source,
        });
      } else if (source === 'refined') {
        actions.setRefinedSpans(spansData);
        log.debug('Refined spans stored', {
          operation: 'optimize',
          spanCount: normalizedSpans.length,
          source,
        });
      }
    },
    onRefined: (refined: string, metadata?: Record<string, unknown>) => {
      if (abortController.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      const refinementDuration = logger.endTimer('optimize');

      markRefinementComplete();
      measureDraftToRefined();
      measureOptimizeToRefinedTotal();

      log.debug('Refinement callback triggered', {
        operation: 'optimize',
        stage: 'refined',
        refinedLength: refined.length,
        duration: refinementDuration,
      });

      const refinedScore = calculateQualityScore(promptToOptimize, refined);

      actions.setOptimizedPrompt(refined);
      if (!refinedSpans) {
        actions.setDisplayedPrompt(refined);
      }
      if (metadata?.genericPrompt && typeof metadata.genericPrompt === 'string') {
        actions.setGenericOptimizedPrompt(metadata.genericPrompt);
      }
      if (metadata?.previewPrompt && typeof metadata.previewPrompt === 'string') {
        actions.setPreviewPrompt(metadata.previewPrompt);
      }
      if (typeof metadata?.aspectRatio === 'string' && metadata.aspectRatio.trim()) {
        actions.setPreviewAspectRatio(metadata.aspectRatio.trim());
      }

      actions.setQualityScore(refinedScore);
      actions.setIsRefining(false);

      log.info('Refinement complete', {
        operation: 'optimize',
        stage: 'refined',
        duration: refinementDuration,
        score: refinedScore,
        outputLength: refined.length,
      });

      if (refinedScore >= 80) {
        toast.success(`Excellent prompt! Quality score: ${refinedScore}%`);
      } else if (refinedScore >= 60) {
        toast.success(`Refined! Quality score: ${refinedScore}%`);
      } else {
        toast.info(`Refined! Score: ${refinedScore}%`);
      }
    },
    onError: (error: Error) => {
      if (abortController.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      log.error('Optimization stream error', error, {
        operation: 'optimize',
        mode: selectedMode,
      });
      actions.setIsRefining(false);
      actions.setIsProcessing(false);
    },
  });

  const totalDuration = logger.endTimer('optimize');

  if (result.usedFallback) {
    log.info('Two-stage optimization fell back to single-stage', {
      operation: 'optimize',
      usedFallback: true,
    });
    toast.warning(
      'Fast optimization unavailable. Using standard optimization (this may take longer).'
    );
  }

  log.info('Two-stage optimization completed', {
    operation: 'optimize',
    duration: totalDuration,
    usedFallback: result.usedFallback,
    outputLength: result.refined?.length || 0,
  });

  if (abortController.signal.aborted || requestId !== requestIdRef.current) {
    return null;
  }

  if (result.metadata?.previewPrompt && typeof result.metadata.previewPrompt === 'string') {
    actions.setPreviewPrompt(result.metadata.previewPrompt);
  }
  if (result.metadata?.genericPrompt && typeof result.metadata.genericPrompt === 'string') {
    actions.setGenericOptimizedPrompt(result.metadata.genericPrompt);
  }
  if (typeof result.metadata?.aspectRatio === 'string' && result.metadata.aspectRatio.trim()) {
    actions.setPreviewAspectRatio(result.metadata.aspectRatio.trim());
  }

  return {
    optimized: result.refined,
    score: calculateQualityScore(promptToOptimize, result.refined),
  };
}

export interface SingleStageOptimizationOptions {
  promptToOptimize: string;
  selectedMode: string;
  selectedModel?: string;
  context: unknown | null;
  brainstormContext: unknown | null;
  generationParams?: CapabilityValues;
  abortController: AbortController;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  actions: PromptOptimizerActions;
  toast: Toast;
  log: ReturnType<typeof logger.child>;
  analyzeAndOptimize: AnalyzeAndOptimize;
  calculateQualityScore: (inputPrompt: string, outputPrompt: string) => number;
}

export async function runSingleStageOptimization({
  promptToOptimize,
  selectedMode,
  selectedModel,
  context,
  brainstormContext,
  generationParams,
  abortController,
  skipCache,
  lockedSpans,
  actions,
  toast,
  log,
  analyzeAndOptimize,
  calculateQualityScore,
}: SingleStageOptimizationOptions): Promise<OptimizationOutcome | null> {
  log.debug('Starting single-stage optimization', {
    operation: 'optimize',
    stage: 'single-stage',
  });

  const response = await analyzeAndOptimize({
    prompt: promptToOptimize,
    context,
    brainstormContext,
    signal: abortController.signal,
    ...(selectedModel ? { targetModel: selectedModel } : {}),
    ...(generationParams ? { generationParams } : {}),
    ...(skipCache ? { skipCache } : {}),
    ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
  });

  const optimized = response.optimizedPrompt;
  const score = calculateQualityScore(promptToOptimize, optimized);

  actions.setOptimizedPrompt(optimized);
  actions.setQualityScore(score);
  if (response.metadata?.genericPrompt && typeof response.metadata.genericPrompt === 'string') {
    actions.setGenericOptimizedPrompt(response.metadata.genericPrompt);
  }
  if (response.metadata?.previewPrompt && typeof response.metadata.previewPrompt === 'string') {
    actions.setPreviewPrompt(response.metadata.previewPrompt);
  }
  if (typeof response.metadata?.aspectRatio === 'string' && response.metadata.aspectRatio.trim()) {
    actions.setPreviewAspectRatio(response.metadata.aspectRatio.trim());
  }

  if (score >= 80) {
    toast.success(`Excellent prompt! Quality score: ${score}%`);
  } else if (score >= 60) {
    toast.info(`Good prompt! Quality score: ${score}%`);
  } else {
    toast.warning(`Prompt could be improved. Score: ${score}%`);
  }

  const duration = logger.endTimer('optimize');
  log.info('optimize completed (single-stage)', {
    operation: 'optimize',
    duration,
    score,
    outputLength: optimized?.length || 0,
  });

  return { optimized, score };
}
