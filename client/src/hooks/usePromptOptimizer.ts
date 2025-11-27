/**
 * usePromptOptimizer - Orchestrator Hook
 *
 * Coordinates prompt optimization workflow by delegating to:
 * - usePromptOptimizerState: State management
 * - performanceMetrics: Performance measurement
 * - promptOptimizationApiV2: API calls
 *
 * Single Responsibility: Orchestrate the prompt optimization workflow
 */

import { useCallback } from 'react';
import { useToast } from '../components/Toast';
import { promptOptimizationApiV2 } from '../services';
import { usePromptOptimizerState, type SpansData } from './usePromptOptimizerState';
import {
  markOptimizationStart,
  markDraftReady,
  markRefinementComplete,
  markSpansReceived,
  measureOptimizeToDraft,
  measureDraftToRefined,
  measureOptimizeToRefinedTotal,
} from './utils/performanceMetrics';
import type { Toast } from './types';

// Simple logger for client-side debugging
const logger = {
  debug: (msg: string, data?: unknown) => console.debug(`[usePromptOptimizer] ${msg}`, data),
  info: (msg: string, data?: unknown) => console.info(`[usePromptOptimizer] ${msg}`, data),
  warn: (msg: string, data?: unknown) => console.warn(`[usePromptOptimizer] ${msg}`, data),
  error: (msg: string, data?: unknown) => console.error(`[usePromptOptimizer] ${msg}`, data),
};

export const usePromptOptimizer = (selectedMode: string, useTwoStage: boolean = true) => {
  const toast = useToast() as Toast;
  const {
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setQualityScore,
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

  const analyzeAndOptimize = useCallback(
    async (prompt: string, context: unknown | null = null, brainstormContext: unknown | null = null) => {
      try {
        const data = await promptOptimizationApiV2.optimizeLegacy({
          prompt,
          mode: selectedMode,
          context,
          brainstormContext,
        });
        return data.optimizedPrompt;
      } catch (error) {
        console.error('Error calling optimization API:', error);
        throw error;
      }
    },
    [selectedMode]
  );

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

      startOptimization();
      setIsProcessing(true);

      try {
        markOptimizationStart();

        // Use two-stage optimization if enabled
        if (useTwoStage) {
          const result = await promptOptimizationApiV2.optimizeWithFallback({
            prompt: promptToOptimize,
            mode: selectedMode,
            context,
            brainstormContext,
            onDraft: (draft: string) => {
              markDraftReady();
              measureOptimizeToDraft();

              // Draft is ready - show it immediately
              setDraftPrompt(draft);
              setOptimizedPrompt(draft);
              setDisplayedPrompt(draft);
              setIsDraftReady(true);
              setIsRefining(true);
              setIsProcessing(false);

              // Calculate draft score
              const draftScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, draft);
              setQualityScore(draftScore);

              toast.info('Draft ready! Refining in background...');
            },
            onSpans: (spans: unknown[], source: string, meta?: unknown) => {
              markSpansReceived(source);

              // Store spans based on source (draft or refined)
              const spansData: SpansData = {
                spans: spans || [],
                meta: meta || null,
                source,
                timestamp: Date.now(),
              };

              if (source === 'draft') {
                setDraftSpans(spansData);
                logger.debug('Draft spans received', {
                  spanCount: Array.isArray(spans) ? spans.length : 0,
                  source,
                });
              } else if (source === 'refined') {
                setRefinedSpans(spansData);
                logger.debug('Refined spans received', {
                  spanCount: Array.isArray(spans) ? spans.length : 0,
                  source,
                });
              }
            },
            onRefined: (refined: string) => {
              markRefinementComplete();
              measureDraftToRefined();
              measureOptimizeToRefinedTotal();

              // Refinement complete - upgrade to refined version
              const refinedScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, refined);

              setOptimizedPrompt(refined);
              // IMPORTANT: Don't update displayedPrompt yet if we're waiting for refined spans
              if (!state.refinedSpans) {
                setDisplayedPrompt(refined);
              }

              setQualityScore(refinedScore);
              setIsRefining(false);

              if (refinedScore >= 80) {
                toast.success(`Excellent prompt! Quality score: ${refinedScore}%`);
              } else if (refinedScore >= 60) {
                toast.success(`Refined! Quality score: ${refinedScore}%`);
              } else {
                toast.info(`Refined! Score: ${refinedScore}%`);
              }
            },
          });

          // Check if two-stage fell back to single-stage
          if (result.usedFallback) {
            toast.warning('Fast optimization unavailable. Using standard optimization (this may take longer).');
          }

          return {
            optimized: result.refined,
            score: promptOptimizationApiV2.calculateQualityScore(promptToOptimize, result.refined),
          };
        } else {
          // Fallback to legacy single-stage optimization
          const optimized = await analyzeAndOptimize(promptToOptimize, context, brainstormContext);
          const score = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, optimized);

          setOptimizedPrompt(optimized);
          setQualityScore(score);

          // Show quality score toast
          if (score >= 80) {
            toast.success(`Excellent prompt! Quality score: ${score}%`);
          } else if (score >= 60) {
            toast.info(`Good prompt! Quality score: ${score}%`);
          } else {
            toast.warning(`Prompt could be improved. Score: ${score}%`);
          }

          return { optimized, score };
        }
      } catch (error) {
        console.error('Optimization failed:', error);
        toast.error('Failed to optimize. Make sure the server is running.');
        return null;
      } finally {
        setIsProcessing(false);
        setIsRefining(false);
      }
    },
    [
      state.inputPrompt,
      state.improvementContext,
      state.refinedSpans,
      analyzeAndOptimize,
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
      setDraftSpans,
      setRefinedSpans,
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
