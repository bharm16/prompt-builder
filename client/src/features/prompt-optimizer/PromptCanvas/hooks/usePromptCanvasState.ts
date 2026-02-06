/**
 * usePromptCanvasState Hook
 * 
 * Centralizes UI state management using useReducer.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useCallback, useReducer } from 'react';

import type { PromptCanvasAction, PromptCanvasState } from '../types';

const initialState: PromptCanvasState = {
  showExportMenu: false,
  showLegend: false,
  rightPaneMode: 'refine',
  showHighlights: true,
  visualLastGeneratedAt: null,
  videoLastGeneratedAt: null,
  visualGenerateRequestId: 0,
  videoGenerateRequestId: 0,
  isEditing: false,
  originalInputPrompt: '',
  originalSelectedModel: undefined,
  selectedSpanId: null,
  lastAppliedSpanId: null,
  hasInteracted: false,
  hoveredSpanId: null,
  lastSwapTime: null,
  promptState: 'generated',
  generatedTimestamp: null,
  justReplaced: null,
};

function promptCanvasReducer(
  state: PromptCanvasState,
  action: PromptCanvasAction
): PromptCanvasState {
  switch (action.type) {
    case 'MERGE_STATE': {
      const keys = Object.keys(action.payload) as Array<keyof PromptCanvasState>;
      let changed = false;
      for (const key of keys) {
        if (!Object.is(state[key], action.payload[key])) {
          changed = true;
          break;
        }
      }
      return changed ? { ...state, ...action.payload } : state;
    }
    case 'INCREMENT_VISUAL_REQUEST_ID':
      return { ...state, visualGenerateRequestId: state.visualGenerateRequestId + 1 };
    case 'INCREMENT_VIDEO_REQUEST_ID':
      return { ...state, videoGenerateRequestId: state.videoGenerateRequestId + 1 };
    default:
      return state;
  }
}

export interface UsePromptCanvasStateReturn {
  state: PromptCanvasState;
  setState: (payload: Partial<PromptCanvasState>) => void;
  incrementVisualRequestId: () => void;
  incrementVideoRequestId: () => void;
}

export function usePromptCanvasState(): UsePromptCanvasStateReturn {
  const [state, dispatch] = useReducer(promptCanvasReducer, initialState);

  const setState = useCallback((payload: Partial<PromptCanvasState>) => {
    dispatch({ type: 'MERGE_STATE', payload });
  }, []);

  const incrementVisualRequestId = useCallback(() => {
    dispatch({ type: 'INCREMENT_VISUAL_REQUEST_ID' });
  }, []);

  const incrementVideoRequestId = useCallback(() => {
    dispatch({ type: 'INCREMENT_VIDEO_REQUEST_ID' });
  }, []);

  return { state, setState, incrementVisualRequestId, incrementVideoRequestId };
}
