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

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { logger } from '../services/LoggingService';
import type { Toast } from './types';
import type { PromptOptimizerActions } from './utils/promptOptimizationFlow';

import { usePromptOptimizerApi } from './usePromptOptimizerApi';
import { usePromptOptimizerState } from './usePromptOptimizerState';
import { markOptimizationStart } from './utils/performanceMetrics';
import { runSingleStageOptimization, runTwoStageOptimization } from './utils/promptOptimizationFlow';

const log = logger.child('usePromptOptimizer');

export const usePromptOptimizer = (selectedMode: string, selectedModel?: string, useTwoStage: boolean = true) => {
  const toast = useToast() as Toast;
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const {
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
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
    startOptimization,
    resetPrompt,
    setIsProcessing,
  } = usePromptOptimizerState();

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);
  const { analyzeAndOptimize, optimizeWithFallback, calculateQualityScore } =
    usePromptOptimizerApi(selectedMode, log);

  const optimize = useCallback(
    async (
      promptToOptimize: string = state.inputPrompt,
      context: unknown | null = state.improvementContext,
      brainstormContext: unknown | null = null
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
          setIsDraftReady,
          setIsRefining,
          setIsProcessing,
          setDraftSpans,
          setRefinedSpans,
          setQualityScore,
          setPreviewPrompt,
          setPreviewAspectRatio,
        };

        if (useTwoStage) {
          return runTwoStageOptimization({
            promptToOptimize,
            selectedMode,
            selectedModel,
            context,
            brainstormContext,
            abortController,
            requestId,
            requestIdRef,
            refinedSpans: state.refinedSpans,
            actions,
            toast,
            log,
            optimizeWithFallback,
            calculateQualityScore,
          });
        }

        return runSingleStageOptimization({
          promptToOptimize,
          selectedMode,
          selectedModel,
          context,
          brainstormContext,
          abortController,
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

  return {
    // State
    inputPrompt: state.inputPrompt,
    setInputPrompt,
    isProcessing: state.isProcessing,
    optimizedPrompt: state.optimizedPrompt,
    setOptimizedPrompt,
    displayedPrompt: state.displayedPrompt,
    setDisplayedPrompt,
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

    // Actions
    optimize,
    resetPrompt,
  };
};
