/**
 * usePromptOptimizer - Orchestrator Hook
 *
 * Coordinates prompt optimization workflow by delegating to:
 * - usePromptOptimizerState: State management
 * - performanceMetrics: Performance measurement
 * - usePromptOptimizerApi: API calls
 * - promptOptimizationFlow: Two-stage/single-stage orchestration
 *
 * Single Responsibility: Orchestrate the prompt optimization workflow
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../components/Toast';
import { logger } from '../services/LoggingService';
import type { Toast } from './types';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptOptimizerActions, OptimizationOutcome } from './utils/promptOptimizationFlow';
import type { PromptOptimizerState } from './usePromptOptimizerState';
import type { LockedSpan } from '@/features/prompt-optimizer/types';

import { usePromptOptimizerApi } from './usePromptOptimizerApi';
import { usePromptOptimizerState } from './usePromptOptimizerState';
import { markOptimizationStart } from './utils/performanceMetrics';
import { runSingleStageOptimization, runTwoStageOptimization } from './utils/promptOptimizationFlow';

const log = logger.child('usePromptOptimizer');

interface OptimizationOptions {
  skipCache?: boolean;
  generationParams?: CapabilityValues;
  startImage?: string;
  sourcePrompt?: string;
  constraintMode?: 'strict' | 'flexible' | 'transform';
}

interface UsePromptOptimizerResult {
  inputPrompt: string;
  setInputPrompt: (prompt: string) => void;
  isProcessing: boolean;
  optimizedPrompt: string;
  setOptimizedPrompt: (prompt: string) => void;
  displayedPrompt: string;
  setDisplayedPrompt: (prompt: string) => void;
  genericOptimizedPrompt: string | null;
  setGenericOptimizedPrompt: (prompt: string | null) => void;
  previewPrompt: string | null;
  setPreviewPrompt: (prompt: string | null) => void;
  previewAspectRatio: string | null;
  setPreviewAspectRatio: (ratio: string | null) => void;
  qualityScore: number | null;
  skipAnimation: boolean;
  setSkipAnimation: (skip: boolean) => void;
  improvementContext: unknown | null;
  setImprovementContext: (context: unknown | null) => void;
  draftPrompt: string;
  isDraftReady: boolean;
  isRefining: boolean;
  draftSpans: PromptOptimizerState['draftSpans'];
  refinedSpans: PromptOptimizerState['refinedSpans'];
  lockedSpans: LockedSpan[];
  optimize: (
    promptToOptimize?: string,
    context?: unknown | null,
    brainstormContext?: unknown | null,
    targetModel?: string,
    options?: OptimizationOptions
  ) => Promise<OptimizationOutcome | null>;
  compile: (
    promptToCompile: string,
    targetModel?: string,
    context?: unknown | null
  ) => Promise<{ optimized: string; score: number | null } | null>;
  resetPrompt: () => void;
  setLockedSpans: (spans: LockedSpan[]) => void;
  addLockedSpan: (span: LockedSpan) => void;
  removeLockedSpan: (spanId: string) => void;
  clearLockedSpans: () => void;
}

export const usePromptOptimizer = (
  selectedMode: string,
  selectedModel?: string,
  useTwoStage: boolean = true
): UsePromptOptimizerResult => {
  const toast = useToast() as Toast;
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const {
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setGenericOptimizedPrompt,
    setQualityScore,
    setPreviewPrompt,
    setPreviewAspectRatio,
    setSkipAnimation,
    setImprovementContext,
    setDraftPrompt,
    setIsDraftReady,
    setIsRefining,
    setDraftSpans,
    setRefinedSpans,
    setLockedSpans,
    addLockedSpan,
    removeLockedSpan,
    clearLockedSpans,
    startOptimization,
    resetPrompt,
    setIsProcessing,
  } = usePromptOptimizerState();

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  const { analyzeAndOptimize, optimizeWithFallback, compilePrompt, calculateQualityScore } =
    usePromptOptimizerApi(selectedMode, log);

  const optimize = useCallback(
    async (
      promptToOptimize: string = state.inputPrompt,
      context: unknown | null = state.improvementContext,
      brainstormContext: unknown | null = null,
      targetModel?: string,
      options?: OptimizationOptions
    ) => {
      if (!promptToOptimize.trim()) {
        toast.warning('Please enter a prompt');
        return null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const requestId = ++requestIdRef.current;

      log.debug('optimize called', {
        operation: 'optimize',
        promptLength: promptToOptimize.length,
        mode: selectedMode,
        useTwoStage,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
        skipCache: options?.skipCache ?? false,
        lockedSpanCount: state.lockedSpans.length,
      });
      logger.startTimer('optimize');

      startOptimization();
      setIsProcessing(true);

      try {
        markOptimizationStart();

        const actions: PromptOptimizerActions = {
          setDraftPrompt,
          setOptimizedPrompt,
          setDisplayedPrompt,
          setGenericOptimizedPrompt,
          setIsDraftReady,
          setIsRefining,
          setIsProcessing,
          setDraftSpans,
          setRefinedSpans,
          setQualityScore,
          setPreviewPrompt,
          setPreviewAspectRatio,
        };

        const overrideModel =
          typeof targetModel === 'string' && targetModel.trim()
            ? targetModel
            : undefined;
        const normalizedSelectedModel =
          overrideModel ??
          (typeof selectedModel === 'string' && selectedModel.trim()
            ? selectedModel
            : undefined);

        const hasStartImage =
          typeof options?.startImage === 'string' && options.startImage.trim().length > 0;
        const shouldUseTwoStage = useTwoStage && !hasStartImage;

        if (shouldUseTwoStage) {
          return await runTwoStageOptimization({
            promptToOptimize,
            selectedMode,
            ...(normalizedSelectedModel ? { selectedModel: normalizedSelectedModel } : {}),
            context,
            brainstormContext,
            abortController,
            ...(typeof options?.skipCache === 'boolean' ? { skipCache: options.skipCache } : {}),
            ...(options?.generationParams ? { generationParams: options.generationParams } : {}),
            requestId,
            requestIdRef,
            refinedSpans: state.refinedSpans,
            lockedSpans: state.lockedSpans,
            actions,
            toast,
            log,
            optimizeWithFallback,
            calculateQualityScore,
          });
        }

        return await runSingleStageOptimization({
          promptToOptimize,
          selectedMode,
          ...(normalizedSelectedModel ? { selectedModel: normalizedSelectedModel } : {}),
          context,
          brainstormContext,
          abortController,
          ...(typeof options?.skipCache === 'boolean' ? { skipCache: options.skipCache } : {}),
          ...(options?.generationParams ? { generationParams: options.generationParams } : {}),
          ...(options?.startImage ? { startImage: options.startImage } : {}),
          ...(options?.sourcePrompt ? { sourcePrompt: options.sourcePrompt } : {}),
          ...(options?.constraintMode ? { constraintMode: options.constraintMode } : {}),
          lockedSpans: state.lockedSpans,
          actions,
          toast,
          log,
          analyzeAndOptimize,
          calculateQualityScore,
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          log.debug('Optimization aborted', {
            operation: 'optimize',
            mode: selectedMode,
          });
          return null;
        }
        const duration = logger.endTimer('optimize');
        log.error('optimize failed', error as Error, {
          operation: 'optimize',
          duration,
          mode: selectedMode,
          useTwoStage,
        });
        toast.error('Failed to optimize. Make sure the server is running.');
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsProcessing(false);
          setIsRefining(false);
        }
      }
    },
    [
      state.inputPrompt,
      state.improvementContext,
      state.refinedSpans,
      state.lockedSpans,
      analyzeAndOptimize,
      optimizeWithFallback,
      calculateQualityScore,
      toast,
      useTwoStage,
      selectedMode,
      startOptimization,
      setIsProcessing,
      setDraftPrompt,
      setOptimizedPrompt,
      setDisplayedPrompt,
      setGenericOptimizedPrompt,
      setIsDraftReady,
      setIsRefining,
      setQualityScore,
      setPreviewPrompt,
      setPreviewAspectRatio,
      setDraftSpans,
      setRefinedSpans,
      selectedModel,
    ]
  );

  const compile = useCallback(
    async (
      promptToCompile: string,
      targetModel?: string,
      context: unknown | null = state.improvementContext
    ) => {
      if (!promptToCompile.trim()) {
        toast.warning('No prompt available to compile');
        return null;
      }

      const resolvedModel =
        typeof targetModel === 'string' && targetModel.trim()
          ? targetModel
          : (typeof selectedModel === 'string' && selectedModel.trim()
            ? selectedModel
            : undefined);

      if (!resolvedModel) {
        toast.warning('Select a model to compile');
        return null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const requestId = ++requestIdRef.current;

      setIsProcessing(true);
      setIsRefining(false);
      setIsDraftReady(false);
      setDraftSpans(null);
      setRefinedSpans(null);

      try {
        const result = await compilePrompt({
          prompt: promptToCompile,
          targetModel: resolvedModel,
          context,
          signal: abortController.signal,
        });

        if (abortController.signal.aborted || requestId !== requestIdRef.current) {
          return null;
        }

        const compiled = result.compiledPrompt;
        setOptimizedPrompt(compiled);
        setDisplayedPrompt(compiled);
        setGenericOptimizedPrompt(promptToCompile);

        if (result.metadata?.previewPrompt && typeof result.metadata.previewPrompt === 'string') {
          setPreviewPrompt(result.metadata.previewPrompt);
        }
        if (typeof result.metadata?.aspectRatio === 'string' && result.metadata.aspectRatio.trim()) {
          setPreviewAspectRatio(result.metadata.aspectRatio.trim());
        }

        return {
          optimized: compiled,
          score: state.qualityScore,
        };
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          log.debug('Compile aborted', { operation: 'compile' });
          return null;
        }
        log.error('compile failed', error as Error, {
          operation: 'compile',
          mode: selectedMode,
        });
        toast.error('Failed to compile. Make sure the server is running.');
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsProcessing(false);
          setIsRefining(false);
        }
      }
    },
    [
      state.improvementContext,
      state.qualityScore,
      compilePrompt,
      selectedMode,
      selectedModel,
      setIsProcessing,
      setIsRefining,
      setIsDraftReady,
      setDraftSpans,
      setRefinedSpans,
      setOptimizedPrompt,
      setDisplayedPrompt,
      setGenericOptimizedPrompt,
      setPreviewPrompt,
      setPreviewAspectRatio,
      toast,
      log,
    ]
  );

  return useMemo<UsePromptOptimizerResult>(() => ({
    // State
    inputPrompt: state.inputPrompt,
    setInputPrompt,
    isProcessing: state.isProcessing,
    optimizedPrompt: state.optimizedPrompt,
    setOptimizedPrompt,
    displayedPrompt: state.displayedPrompt,
    setDisplayedPrompt,
    genericOptimizedPrompt: state.genericOptimizedPrompt,
    setGenericOptimizedPrompt,
    previewPrompt: state.previewPrompt,
    setPreviewPrompt,
    previewAspectRatio: state.previewAspectRatio,
    setPreviewAspectRatio,
    qualityScore: state.qualityScore,
    skipAnimation: state.skipAnimation,
    setSkipAnimation,
    improvementContext: state.improvementContext,
    setImprovementContext,

    // Two-stage state
    draftPrompt: state.draftPrompt,
    isDraftReady: state.isDraftReady,
    isRefining: state.isRefining,

    // Span labeling state
    draftSpans: state.draftSpans,
    refinedSpans: state.refinedSpans,
    lockedSpans: state.lockedSpans,

    // Actions
    optimize,
    compile,
    resetPrompt,
    setLockedSpans,
    addLockedSpan,
    removeLockedSpan,
    clearLockedSpans,
  }), [
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setGenericOptimizedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
    setSkipAnimation,
    setImprovementContext,
    optimize,
    compile,
    resetPrompt,
    setLockedSpans,
    addLockedSpan,
    removeLockedSpan,
    clearLockedSpans,
  ]);
};
