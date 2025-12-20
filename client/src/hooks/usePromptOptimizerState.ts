/**
 * usePromptOptimizerState
 *
 * State management hook for prompt optimizer using useReducer.
 * Manages all state related to prompt optimization, two-stage optimization, and span labeling.
 */

import { useReducer, useCallback } from 'react';
import { logger } from '../services/LoggingService';

const log = logger.child('usePromptOptimizerState');

export interface SpansData {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
  source: string;
  timestamp: number;
}

export interface PromptOptimizerState {
  inputPrompt: string;
  isProcessing: boolean;
  optimizedPrompt: string;
  displayedPrompt: string;
  previewPrompt: string | null;
  previewAspectRatio: string | null;
  qualityScore: number | null;
  skipAnimation: boolean;
  improvementContext: unknown | null;
  draftPrompt: string;
  isDraftReady: boolean;
  isRefining: boolean;
  draftSpans: SpansData | null;
  refinedSpans: SpansData | null;
}

export type PromptOptimizerAction =
  | { type: 'SET_INPUT_PROMPT'; payload: string }
  | { type: 'SET_OPTIMIZED_PROMPT'; payload: string }
  | { type: 'SET_DISPLAYED_PROMPT'; payload: string }
  | { type: 'SET_PREVIEW_PROMPT'; payload: string | null }
  | { type: 'SET_PREVIEW_ASPECT_RATIO'; payload: string | null }
  | { type: 'SET_QUALITY_SCORE'; payload: number | null }
  | { type: 'SET_SKIP_ANIMATION'; payload: boolean }
  | { type: 'SET_IMPROVEMENT_CONTEXT'; payload: unknown | null }
  | { type: 'SET_DRAFT_PROMPT'; payload: string }
  | { type: 'SET_IS_DRAFT_READY'; payload: boolean }
  | { type: 'SET_IS_REFINING'; payload: boolean }
  | { type: 'SET_DRAFT_SPANS'; payload: SpansData | null }
  | { type: 'SET_REFINED_SPANS'; payload: SpansData | null }
  | { type: 'SET_IS_PROCESSING'; payload: boolean }
  | { type: 'START_OPTIMIZATION' }
  | { type: 'RESET' };

const initialState: PromptOptimizerState = {
  inputPrompt: '',
  isProcessing: false,
  optimizedPrompt: '',
  displayedPrompt: '',
  previewPrompt: null,
  previewAspectRatio: null,
  qualityScore: null,
  skipAnimation: false,
  improvementContext: null,
  draftPrompt: '',
  isDraftReady: false,
  isRefining: false,
  draftSpans: null,
  refinedSpans: null,
};

function reducer(
  state: PromptOptimizerState,
  action: PromptOptimizerAction
): PromptOptimizerState {
  // Log state transitions for debugging
  log.debug('State transition', {
    action: action.type,
    previousState: {
      isProcessing: state.isProcessing,
      isDraftReady: state.isDraftReady,
      isRefining: state.isRefining,
      hasOptimizedPrompt: !!state.optimizedPrompt,
      hasDraftSpans: !!state.draftSpans,
      hasRefinedSpans: !!state.refinedSpans,
    },
  });

  switch (action.type) {
    case 'SET_INPUT_PROMPT':
      return { ...state, inputPrompt: action.payload };
    case 'SET_OPTIMIZED_PROMPT':
      return { ...state, optimizedPrompt: action.payload };
    case 'SET_DISPLAYED_PROMPT':
      return { ...state, displayedPrompt: action.payload };
    case 'SET_PREVIEW_PROMPT':
      return { ...state, previewPrompt: action.payload };
    case 'SET_PREVIEW_ASPECT_RATIO':
      return { ...state, previewAspectRatio: action.payload };
    case 'SET_QUALITY_SCORE':
      return { ...state, qualityScore: action.payload };
    case 'SET_SKIP_ANIMATION':
      return { ...state, skipAnimation: action.payload };
    case 'SET_IMPROVEMENT_CONTEXT':
      return { ...state, improvementContext: action.payload };
    case 'SET_DRAFT_PROMPT':
      return { ...state, draftPrompt: action.payload };
    case 'SET_IS_DRAFT_READY':
      return { ...state, isDraftReady: action.payload };
    case 'SET_IS_REFINING':
      return { ...state, isRefining: action.payload };
    case 'SET_DRAFT_SPANS':
      return { ...state, draftSpans: action.payload };
    case 'SET_REFINED_SPANS':
      return { ...state, refinedSpans: action.payload };
    case 'SET_IS_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'START_OPTIMIZATION':
      log.debug('Starting optimization - resetting state', {
        action: 'START_OPTIMIZATION',
      });
      return {
        ...state,
        isProcessing: true,
        optimizedPrompt: '',
        displayedPrompt: '',
        previewPrompt: null,
        previewAspectRatio: null,
        qualityScore: null,
        skipAnimation: false,
        draftPrompt: '',
        isDraftReady: false,
        isRefining: false,
        draftSpans: null,
        refinedSpans: null,
      };
    case 'RESET':
      log.debug('Resetting state to initial', {
        action: 'RESET',
      });
      return initialState;
    default:
      return state;
  }
}

/**
 * Hook for managing prompt optimizer state with useReducer
 */
export function usePromptOptimizerState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setInputPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_INPUT_PROMPT', payload: prompt });
  }, []);

  const setOptimizedPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_OPTIMIZED_PROMPT', payload: prompt });
  }, []);

  const setDisplayedPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_DISPLAYED_PROMPT', payload: prompt });
  }, []);

  const setQualityScore = useCallback((score: number | null) => {
    dispatch({ type: 'SET_QUALITY_SCORE', payload: score });
  }, []);

  const setPreviewPrompt = useCallback((prompt: string | null) => {
    dispatch({ type: 'SET_PREVIEW_PROMPT', payload: prompt });
  }, []);

  const setPreviewAspectRatio = useCallback((ratio: string | null) => {
    dispatch({ type: 'SET_PREVIEW_ASPECT_RATIO', payload: ratio });
  }, []);

  const setSkipAnimation = useCallback((skip: boolean) => {
    dispatch({ type: 'SET_SKIP_ANIMATION', payload: skip });
  }, []);

  const setImprovementContext = useCallback((context: unknown | null) => {
    dispatch({ type: 'SET_IMPROVEMENT_CONTEXT', payload: context });
  }, []);

  const setDraftPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_DRAFT_PROMPT', payload: prompt });
  }, []);

  const setIsDraftReady = useCallback((ready: boolean) => {
    dispatch({ type: 'SET_IS_DRAFT_READY', payload: ready });
  }, []);

  const setIsRefining = useCallback((refining: boolean) => {
    dispatch({ type: 'SET_IS_REFINING', payload: refining });
  }, []);

  const setDraftSpans = useCallback((spans: SpansData | null) => {
    dispatch({ type: 'SET_DRAFT_SPANS', payload: spans });
  }, []);

  const setRefinedSpans = useCallback((spans: SpansData | null) => {
    dispatch({ type: 'SET_REFINED_SPANS', payload: spans });
  }, []);

  const startOptimization = useCallback(() => {
    dispatch({ type: 'START_OPTIMIZATION' });
  }, []);

  const resetPrompt = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const finishProcessing = useCallback(() => {
    dispatch({ type: 'SET_IS_REFINING', payload: false });
    // Note: isProcessing is set to false via separate action after optimization completes
  }, []);

  const setIsProcessing = useCallback((processing: boolean) => {
    dispatch({ type: 'SET_IS_PROCESSING', payload: processing });
    if (!processing) {
      dispatch({ type: 'SET_IS_REFINING', payload: false });
    }
  }, []);

  return {
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
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
    finishProcessing,
    setIsProcessing,
  };
}
