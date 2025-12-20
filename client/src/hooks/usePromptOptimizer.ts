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

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { promptOptimizationApiV2 } from '../services';
import { logger } from '../services/LoggingService';
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

const log = logger.child('usePromptOptimizer');

export const usePromptOptimizer = (selectedMode: string, useTwoStage: boolean = true) => {
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

  const analyzeAndOptimize = useCallback(
    async (
      prompt: string,
      context: unknown | null = null,
      brainstormContext: unknown | null = null,
      signal?: AbortSignal
    ) => {
      log.debug('analyzeAndOptimize called', {
        promptLength: prompt.length,
        mode: selectedMode,
        hasContext: !!context,
        hasBrainstormContext: !!brainstormContext,
      });
      logger.startTimer('analyzeAndOptimize');
      
      try {
        const data = await promptOptimizationApiV2.optimizeLegacy({
          prompt,
          mode: selectedMode,
          context,
          brainstormContext,
          ...(signal ? { signal } : {}),
        });
        
        const duration = logger.endTimer('analyzeAndOptimize');
        log.info('analyzeAndOptimize completed', {
          duration,
          outputLength: data.optimizedPrompt?.length || 0,
        });
        
        return data;
      } catch (error) {
        logger.endTimer('analyzeAndOptimize');
        log.error('analyzeAndOptimize failed', error as Error);
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

        // Use two-stage optimization if enabled
        if (useTwoStage) {
          log.debug('Starting two-stage optimization', {
            operation: 'optimize',
            stage: 'two-stage',
          });

          const result = await promptOptimizationApiV2.optimizeWithFallback({
            prompt: promptToOptimize,
            mode: selectedMode,
            context,
            brainstormContext,
            signal: abortController.signal,
            onDraft: (draft: string) => {
              if (abortController.signal.aborted || requestId !== requestIdRef.current) {
                return;
              }
              const draftDuration = logger.endTimer('optimize');
              logger.startTimer('optimize'); // Restart for refinement phase
              
              markDraftReady();
              measureOptimizeToDraft();

              log.debug('Draft callback triggered', {
                operation: 'optimize',
                stage: 'draft',
                draftLength: draft.length,
                duration: draftDuration,
              });

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

              const normalizedSpans: SpansData['spans'] = Array.isArray(spans)
                ? spans.filter((span): span is SpansData['spans'][number] => {
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
                  })
                : [];

              // Store spans based on source (draft or refined)
              const spansData: SpansData = {
                spans: normalizedSpans,
                meta: (meta as Record<string, unknown>) || null,
                source,
                timestamp: Date.now(),
              };

              if (source === 'draft') {
                setDraftSpans(spansData);
                log.debug('Draft spans stored', {
                  operation: 'optimize',
                  spanCount: Array.isArray(spans) ? spans.length : 0,
                  source,
                });
              } else if (source === 'refined') {
                setRefinedSpans(spansData);
                log.debug('Refined spans stored', {
                  operation: 'optimize',
                  spanCount: Array.isArray(spans) ? spans.length : 0,
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

              // Refinement complete - upgrade to refined version
              const refinedScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, refined);

              setOptimizedPrompt(refined);
              // IMPORTANT: Don't update displayedPrompt yet if we're waiting for refined spans
              if (!state.refinedSpans) {
                setDisplayedPrompt(refined);
              }
              if (metadata?.previewPrompt && typeof metadata.previewPrompt === 'string') {
                setPreviewPrompt(metadata.previewPrompt);
              }

              setQualityScore(refinedScore);
              setIsRefining(false);

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
              setIsRefining(false);
              setIsProcessing(false);
            },
          });

          const totalDuration = logger.endTimer('optimize');

          // Check if two-stage fell back to single-stage
          if (result.usedFallback) {
            log.info('Two-stage optimization fell back to single-stage', {
              operation: 'optimize',
              usedFallback: true,
            });
            toast.warning('Fast optimization unavailable. Using standard optimization (this may take longer).');
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
            setPreviewPrompt(result.metadata.previewPrompt);
          }

          return {
            optimized: result.refined,
            score: promptOptimizationApiV2.calculateQualityScore(promptToOptimize, result.refined),
          };
        } else {
          log.debug('Starting single-stage optimization', {
            operation: 'optimize',
            stage: 'single-stage',
          });

          // Fallback to legacy single-stage optimization
          const response = await analyzeAndOptimize(
            promptToOptimize,
            context,
            brainstormContext,
            abortController.signal
          );
          const optimized = response.optimizedPrompt;
          const score = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, optimized);

          setOptimizedPrompt(optimized);
          setQualityScore(score);
          if (response.metadata?.previewPrompt && typeof response.metadata.previewPrompt === 'string') {
            setPreviewPrompt(response.metadata.previewPrompt);
          }

          // Show quality score toast
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
    previewPrompt: state.previewPrompt,
    setPreviewPrompt,
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
