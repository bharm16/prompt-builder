import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile, VideoTier } from '@components/ToolSidebar/types';
import {
  DEFAULT_GENERATION_CONTROLS_STATE,
  type ConstraintMode,
  type GenerationControlsState,
  type GenerationControlsTab,
  type ImageSubTab,
} from './generationControlsStoreTypes';
import {
  loadGenerationControlsStoreState,
  persistGenerationControlsStoreState,
} from './generationControlsStoreStorage';

const MAX_KEYFRAMES = 3;

type GenerationControlsAction =
  | { type: 'setSelectedModel'; value: string }
  | { type: 'setGenerationParams'; value: CapabilityValues }
  | { type: 'mergeGenerationParams'; value: CapabilityValues }
  | { type: 'setVideoTier'; value: VideoTier }
  | { type: 'setKeyframes'; value: KeyframeTile[] | null | undefined }
  | { type: 'addKeyframe'; value: Omit<KeyframeTile, 'id'> }
  | { type: 'removeKeyframe'; value: string }
  | { type: 'clearKeyframes' }
  | { type: 'setCameraMotion'; value: CameraPath | null }
  | { type: 'setSubjectMotion'; value: string }
  | { type: 'setActiveTab'; value: GenerationControlsTab }
  | { type: 'setImageSubTab'; value: ImageSubTab }
  | { type: 'setConstraintMode'; value: ConstraintMode }
  | { type: 'resetState'; value: GenerationControlsState };

export interface GenerationControlsActions {
  setSelectedModel: (model: string) => void;
  setGenerationParams: (params: CapabilityValues) => void;
  mergeGenerationParams: (params: CapabilityValues) => void;
  setVideoTier: (tier: VideoTier) => void;
  setKeyframes: (tiles: KeyframeTile[] | null | undefined) => void;
  addKeyframe: (tile: Omit<KeyframeTile, 'id'>) => void;
  removeKeyframe: (id: string) => void;
  clearKeyframes: () => void;
  setCameraMotion: (cameraPath: CameraPath | null) => void;
  setSubjectMotion: (motion: string) => void;
  setActiveTab: (tab: GenerationControlsTab) => void;
  setImageSubTab: (subTab: ImageSubTab) => void;
  setConstraintMode: (mode: ConstraintMode) => void;
  resetState: (state: GenerationControlsState) => void;
}

const GenerationControlsStateContext = createContext<GenerationControlsState | null>(null);
const GenerationControlsActionsContext = createContext<GenerationControlsActions | null>(null);

const normalizeKeyframes = (tiles: KeyframeTile[] | null | undefined): KeyframeTile[] => {
  if (!Array.isArray(tiles)) return [];
  return tiles.slice(0, MAX_KEYFRAMES);
};

const createKeyframeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const reconcileMotionAfterKeyframes = (
  state: GenerationControlsState,
  nextKeyframes: KeyframeTile[]
): Pick<GenerationControlsState['domain'], 'cameraMotion' | 'subjectMotion'> => {
  const previousPrimaryId = state.domain.keyframes[0]?.id ?? null;
  const nextPrimaryId = nextKeyframes[0]?.id ?? null;

  if (!nextPrimaryId) {
    if (!previousPrimaryId) {
      return {
        cameraMotion: state.domain.cameraMotion,
        subjectMotion: state.domain.subjectMotion,
      };
    }
    return { cameraMotion: null, subjectMotion: '' };
  }

  if (!previousPrimaryId) {
    return {
      cameraMotion: state.domain.cameraMotion,
      subjectMotion: state.domain.subjectMotion,
    };
  }

  if (previousPrimaryId !== nextPrimaryId) {
    return { cameraMotion: null, subjectMotion: '' };
  }

  return {
    cameraMotion: state.domain.cameraMotion,
    subjectMotion: state.domain.subjectMotion,
  };
};

const reducer = (
  state: GenerationControlsState,
  action: GenerationControlsAction
): GenerationControlsState => {
  switch (action.type) {
    case 'setSelectedModel':
      if (state.domain.selectedModel === action.value) return state;
      return {
        ...state,
        domain: { ...state.domain, selectedModel: action.value },
      };
    case 'setGenerationParams':
      return {
        ...state,
        domain: { ...state.domain, generationParams: action.value },
      };
    case 'mergeGenerationParams':
      return {
        ...state,
        domain: {
          ...state.domain,
          generationParams: { ...state.domain.generationParams, ...action.value },
        },
      };
    case 'setVideoTier':
      if (state.domain.videoTier === action.value) return state;
      return {
        ...state,
        domain: { ...state.domain, videoTier: action.value },
      };
    case 'setKeyframes': {
      const nextKeyframes = normalizeKeyframes(action.value);
      const motion = reconcileMotionAfterKeyframes(state, nextKeyframes);
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
          ...motion,
        },
      };
    }
    case 'addKeyframe': {
      if (state.domain.keyframes.length >= MAX_KEYFRAMES) return state;
      const nextKeyframes = [
        ...state.domain.keyframes,
        { id: createKeyframeId(), ...action.value },
      ];
      const motion = reconcileMotionAfterKeyframes(state, nextKeyframes);
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
          ...motion,
        },
      };
    }
    case 'removeKeyframe': {
      const nextKeyframes = state.domain.keyframes.filter((tile) => tile.id !== action.value);
      if (nextKeyframes.length === state.domain.keyframes.length) return state;
      const motion = reconcileMotionAfterKeyframes(state, nextKeyframes);
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
          ...motion,
        },
      };
    }
    case 'clearKeyframes': {
      if (state.domain.keyframes.length === 0) return state;
      const motion = reconcileMotionAfterKeyframes(state, []);
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: [],
          ...motion,
        },
      };
    }
    case 'setCameraMotion':
      if (state.domain.cameraMotion?.id === action.value?.id) return state;
      return {
        ...state,
        domain: { ...state.domain, cameraMotion: action.value },
      };
    case 'setSubjectMotion':
      if (state.domain.subjectMotion === action.value) return state;
      return {
        ...state,
        domain: { ...state.domain, subjectMotion: action.value },
      };
    case 'setActiveTab':
      if (state.ui.activeTab === action.value) return state;
      return {
        ...state,
        ui: { ...state.ui, activeTab: action.value },
      };
    case 'setImageSubTab':
      if (state.ui.imageSubTab === action.value) return state;
      return {
        ...state,
        ui: { ...state.ui, imageSubTab: action.value },
      };
    case 'setConstraintMode':
      if (state.ui.constraintMode === action.value) return state;
      return {
        ...state,
        ui: { ...state.ui, constraintMode: action.value },
      };
    case 'resetState':
      return action.value;
    default:
      return state;
  }
};

export function GenerationControlsStoreProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: GenerationControlsState;
}): React.ReactElement {
  const [state, dispatch] = useReducer(
    reducer,
    initialState ?? DEFAULT_GENERATION_CONTROLS_STATE,
    (seed) => (initialState ? seed : loadGenerationControlsStoreState())
  );

  useEffect(() => {
    persistGenerationControlsStoreState(state);
  }, [state]);

  const actions = useMemo<GenerationControlsActions>(
    () => ({
      setSelectedModel: (value) => dispatch({ type: 'setSelectedModel', value }),
      setGenerationParams: (value) => dispatch({ type: 'setGenerationParams', value }),
      mergeGenerationParams: (value) => dispatch({ type: 'mergeGenerationParams', value }),
      setVideoTier: (value) => dispatch({ type: 'setVideoTier', value }),
      setKeyframes: (value) => dispatch({ type: 'setKeyframes', value }),
      addKeyframe: (value) => dispatch({ type: 'addKeyframe', value }),
      removeKeyframe: (value) => dispatch({ type: 'removeKeyframe', value }),
      clearKeyframes: () => dispatch({ type: 'clearKeyframes' }),
      setCameraMotion: (value) => dispatch({ type: 'setCameraMotion', value }),
      setSubjectMotion: (value) => dispatch({ type: 'setSubjectMotion', value }),
      setActiveTab: (value) => dispatch({ type: 'setActiveTab', value }),
      setImageSubTab: (value) => dispatch({ type: 'setImageSubTab', value }),
      setConstraintMode: (value) => dispatch({ type: 'setConstraintMode', value }),
      resetState: (value) => dispatch({ type: 'resetState', value }),
    }),
    []
  );

  return (
    <GenerationControlsStateContext.Provider value={state}>
      <GenerationControlsActionsContext.Provider value={actions}>
        {children}
      </GenerationControlsActionsContext.Provider>
    </GenerationControlsStateContext.Provider>
  );
}

export function useGenerationControlsStoreState(): GenerationControlsState {
  const context = useContext(GenerationControlsStateContext);
  if (!context) {
    throw new Error('useGenerationControlsStoreState must be used within GenerationControlsStoreProvider');
  }
  return context;
}

export function useGenerationControlsStoreActions(): GenerationControlsActions {
  const context = useContext(GenerationControlsActionsContext);
  if (!context) {
    throw new Error('useGenerationControlsStoreActions must be used within GenerationControlsStoreProvider');
  }
  return context;
}

export function useGenerationControlsStore(): {
  state: GenerationControlsState;
  actions: GenerationControlsActions;
} {
  return {
    state: useGenerationControlsStoreState(),
    actions: useGenerationControlsStoreActions(),
  };
}
