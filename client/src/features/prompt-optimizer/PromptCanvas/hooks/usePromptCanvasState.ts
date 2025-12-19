/**
 * usePromptCanvasState Hook
 * 
 * Centralizes UI state management using useReducer.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import { useReducer, useMemo } from 'react';
import { createCanonicalText } from '../../../../utils/canonicalText';
import type { CanonicalText } from '../../../../utils/canonicalText';
import type { HighlightSpan } from '../../../span-highlighting/hooks/useHighlightRendering';
import type { PromptCanvasState, PromptCanvasAction, ParseResult } from '../types';

const initialState: PromptCanvasState = {
  showExportMenu: false,
  showLegend: false,
  hasUserEdited: false,
  parseResult: {
    canonical: createCanonicalText('') as CanonicalText,
    spans: [] as HighlightSpan[],
    meta: null,
    status: 'idle',
    error: null,
    displayText: '',
  },
};

function promptCanvasReducer(
  state: PromptCanvasState,
  action: PromptCanvasAction
): PromptCanvasState {
  switch (action.type) {
    case 'SET_SHOW_EXPORT_MENU':
      return { ...state, showExportMenu: action.value };
    case 'SET_SHOW_LEGEND':
      return { ...state, showLegend: action.value };
    case 'SET_HAS_USER_EDITED':
      return { ...state, hasUserEdited: action.value };
    case 'SET_PARSE_RESULT':
      return { ...state, parseResult: action.value };
    case 'RESET_PARSE_RESULT':
      return {
        ...state,
        parseResult: {
          canonical: createCanonicalText(action.displayedPrompt) as CanonicalText,
          spans: [] as HighlightSpan[],
          meta: null,
          status: 'idle',
          error: null,
          displayText: action.displayedPrompt,
        },
      };
    default:
      return state;
  }
}

export interface UsePromptCanvasStateOptions {
  displayedPrompt: string | null;
  isDraftReady: boolean;
}

export interface UsePromptCanvasStateReturn {
  state: PromptCanvasState;
  dispatch: React.Dispatch<PromptCanvasAction>;
}

export function usePromptCanvasState({
  displayedPrompt,
  isDraftReady,
}: UsePromptCanvasStateOptions): UsePromptCanvasStateReturn {
  const [state, dispatch] = useReducer(promptCanvasReducer, initialState);

  // Initialize parse result when displayedPrompt changes
  useMemo(() => {
    if (displayedPrompt !== null && state.parseResult.displayText !== displayedPrompt) {
      dispatch({
        type: 'RESET_PARSE_RESULT',
        displayedPrompt: displayedPrompt,
      });
    }
  }, [displayedPrompt, state.parseResult.displayText]);

  return { state, dispatch };
}

