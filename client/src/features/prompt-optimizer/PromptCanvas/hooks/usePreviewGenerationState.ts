import { useCallback, useReducer } from 'react';

interface PreviewGenerationState {
  visual: boolean;
  video: boolean;
  railVideo: boolean;
}

type PreviewGenerationAction = {
  type: keyof PreviewGenerationState;
  loading: boolean;
};

const initialState: PreviewGenerationState = {
  visual: false,
  video: false,
  railVideo: false,
};

const previewGenerationReducer = (
  state: PreviewGenerationState,
  action: PreviewGenerationAction
): PreviewGenerationState => ({
  ...state,
  [action.type]: action.loading,
});

export interface UsePreviewGenerationStateReturn {
  previewLoading: PreviewGenerationState;
  setVisualPreviewGenerating: (loading: boolean) => void;
  setVideoPreviewGenerating: (loading: boolean) => void;
  setRailVideoPreviewGenerating: (loading: boolean) => void;
}

export function usePreviewGenerationState(): UsePreviewGenerationStateReturn {
  const [previewLoading, dispatch] = useReducer(previewGenerationReducer, initialState);

  const setVisualPreviewGenerating = useCallback((loading: boolean) => {
    dispatch({ type: 'visual', loading });
  }, []);

  const setVideoPreviewGenerating = useCallback((loading: boolean) => {
    dispatch({ type: 'video', loading });
  }, []);

  const setRailVideoPreviewGenerating = useCallback((loading: boolean) => {
    dispatch({ type: 'railVideo', loading });
  }, []);

  return {
    previewLoading,
    setVisualPreviewGenerating,
    setVideoPreviewGenerating,
    setRailVideoPreviewGenerating,
  };
}
