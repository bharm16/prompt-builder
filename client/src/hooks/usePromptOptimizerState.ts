/**
 * usePromptOptimizerState
 *
 * State management hook for prompt optimizer using useReducer.
 */

import { useCallback, useReducer } from 'react';
import { logger } from '../services/LoggingService';
import type { LockedSpan } from '@/features/prompt-optimizer/types';

const log = logger.child('usePromptOptimizerState');

interface RollbackSnapshot {
  inputPrompt: string;
  optimizedPrompt: string;
  displayedPrompt: string;
  genericOptimizedPrompt: string | null;
  artifactKey: string | null;
  previewPrompt: string | null;
  previewAspectRatio: string | null;
  qualityScore: number | null;
  lockedSpans: LockedSpan[];
  improvementContext: unknown | null;
}

export interface PromptOptimizerState {
  inputPrompt: string;
  isProcessing: boolean;
  optimizedPrompt: string;
  displayedPrompt: string;
  genericOptimizedPrompt: string | null;
  artifactKey: string | null;
  previewPrompt: string | null;
  previewAspectRatio: string | null;
  qualityScore: number | null;
  skipAnimation: boolean;
  improvementContext: unknown | null;
  optimizationResultVersion: number;
  lockedSpans: LockedSpan[];
  rollbackSnapshot: RollbackSnapshot | null;
}

export type PromptOptimizerAction =
  | { type: 'SET_INPUT_PROMPT'; payload: string }
  | { type: 'SET_OPTIMIZED_PROMPT'; payload: string }
  | { type: 'SET_DISPLAYED_PROMPT'; payload: string }
  | { type: 'SET_GENERIC_OPTIMIZED_PROMPT'; payload: string | null }
  | { type: 'SET_ARTIFACT_KEY'; payload: string | null }
  | { type: 'SET_PREVIEW_PROMPT'; payload: string | null }
  | { type: 'SET_PREVIEW_ASPECT_RATIO'; payload: string | null }
  | { type: 'SET_QUALITY_SCORE'; payload: number | null }
  | { type: 'SET_SKIP_ANIMATION'; payload: boolean }
  | { type: 'SET_IMPROVEMENT_CONTEXT'; payload: unknown | null }
  | { type: 'SET_IS_PROCESSING'; payload: boolean }
  | { type: 'INCREMENT_OPTIMIZATION_RESULT_VERSION' }
  | { type: 'SET_LOCKED_SPANS'; payload: LockedSpan[] }
  | { type: 'ADD_LOCKED_SPAN'; payload: LockedSpan }
  | { type: 'REMOVE_LOCKED_SPAN'; payload: string }
  | { type: 'CLEAR_LOCKED_SPANS' }
  | { type: 'START_OPTIMIZATION' }
  | { type: 'SNAPSHOT_FOR_ROLLBACK' }
  | { type: 'ROLLBACK' }
  | { type: 'RESET' };

const initialState: PromptOptimizerState = {
  inputPrompt: '',
  isProcessing: false,
  optimizedPrompt: '',
  displayedPrompt: '',
  genericOptimizedPrompt: null,
  artifactKey: null,
  previewPrompt: null,
  previewAspectRatio: null,
  qualityScore: null,
  skipAnimation: false,
  improvementContext: null,
  optimizationResultVersion: 0,
  lockedSpans: [],
  rollbackSnapshot: null,
};

function reducer(
  state: PromptOptimizerState,
  action: PromptOptimizerAction
): PromptOptimizerState {
  log.debug('State transition', {
    action: action.type,
    previousState: {
      isProcessing: state.isProcessing,
      hasOptimizedPrompt: !!state.optimizedPrompt,
      optimizationResultVersion: state.optimizationResultVersion,
    },
  });

  switch (action.type) {
    case 'SET_INPUT_PROMPT':
      return { ...state, inputPrompt: action.payload };
    case 'SET_OPTIMIZED_PROMPT':
      return { ...state, optimizedPrompt: action.payload };
    case 'SET_DISPLAYED_PROMPT':
      return { ...state, displayedPrompt: action.payload };
    case 'SET_GENERIC_OPTIMIZED_PROMPT':
      return { ...state, genericOptimizedPrompt: action.payload };
    case 'SET_ARTIFACT_KEY':
      return { ...state, artifactKey: action.payload };
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
    case 'SET_IS_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'INCREMENT_OPTIMIZATION_RESULT_VERSION':
      return {
        ...state,
        optimizationResultVersion: state.optimizationResultVersion + 1,
      };
    case 'SET_LOCKED_SPANS':
      return { ...state, lockedSpans: action.payload };
    case 'ADD_LOCKED_SPAN': {
      const exists = state.lockedSpans.some((span) => span.id === action.payload.id);
      if (exists) {
        return state;
      }
      return { ...state, lockedSpans: [...state.lockedSpans, action.payload] };
    }
    case 'REMOVE_LOCKED_SPAN':
      return {
        ...state,
        lockedSpans: state.lockedSpans.filter((span) => span.id !== action.payload),
      };
    case 'CLEAR_LOCKED_SPANS':
      return { ...state, lockedSpans: [] };
    case 'SNAPSHOT_FOR_ROLLBACK':
      return {
        ...state,
        rollbackSnapshot: {
          inputPrompt: state.inputPrompt,
          optimizedPrompt: state.optimizedPrompt,
          displayedPrompt: state.displayedPrompt,
          genericOptimizedPrompt: state.genericOptimizedPrompt,
          artifactKey: state.artifactKey,
          previewPrompt: state.previewPrompt,
          previewAspectRatio: state.previewAspectRatio,
          qualityScore: state.qualityScore,
          lockedSpans: state.lockedSpans,
          improvementContext: state.improvementContext,
        },
      };
    case 'ROLLBACK':
      if (!state.rollbackSnapshot) {
        log.warn('ROLLBACK dispatched without snapshot');
        return {
          ...state,
          isProcessing: false,
        };
      }
      return {
        ...state,
        ...state.rollbackSnapshot,
        rollbackSnapshot: null,
        isProcessing: false,
      };
    case 'START_OPTIMIZATION':
      log.debug('Starting optimization', {
        action: 'START_OPTIMIZATION',
      });
      return {
        ...state,
        isProcessing: true,
        skipAnimation: false,
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

  const setGenericOptimizedPrompt = useCallback((prompt: string | null) => {
    dispatch({ type: 'SET_GENERIC_OPTIMIZED_PROMPT', payload: prompt });
  }, []);

  const setArtifactKey = useCallback((artifactKey: string | null) => {
    dispatch({ type: 'SET_ARTIFACT_KEY', payload: artifactKey });
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

  const bumpOptimizationResultVersion = useCallback(() => {
    dispatch({ type: 'INCREMENT_OPTIMIZATION_RESULT_VERSION' });
  }, []);

  const setLockedSpans = useCallback((spans: LockedSpan[]) => {
    dispatch({ type: 'SET_LOCKED_SPANS', payload: spans });
  }, []);

  const addLockedSpan = useCallback((span: LockedSpan) => {
    dispatch({ type: 'ADD_LOCKED_SPAN', payload: span });
  }, []);

  const removeLockedSpan = useCallback((spanId: string) => {
    dispatch({ type: 'REMOVE_LOCKED_SPAN', payload: spanId });
  }, []);

  const clearLockedSpans = useCallback(() => {
    dispatch({ type: 'CLEAR_LOCKED_SPANS' });
  }, []);

  const snapshotForRollback = useCallback(() => {
    dispatch({ type: 'SNAPSHOT_FOR_ROLLBACK' });
  }, []);

  const rollback = useCallback(() => {
    dispatch({ type: 'ROLLBACK' });
  }, []);

  const startOptimization = useCallback(() => {
    dispatch({ type: 'START_OPTIMIZATION' });
  }, []);

  const resetPrompt = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setIsProcessing = useCallback((processing: boolean) => {
    dispatch({ type: 'SET_IS_PROCESSING', payload: processing });
  }, []);

  return {
    state,
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setGenericOptimizedPrompt,
    setArtifactKey,
    setPreviewPrompt,
    setPreviewAspectRatio,
    setQualityScore,
    setSkipAnimation,
    setImprovementContext,
    bumpOptimizationResultVersion,
    setLockedSpans,
    addLockedSpan,
    removeLockedSpan,
    clearLockedSpans,
    snapshotForRollback,
    rollback,
    startOptimization,
    resetPrompt,
    setIsProcessing,
  };
}
