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
  | { type: 'setStartFrame'; value: KeyframeTile | null }
  | { type: 'clearStartFrame' }
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
  setStartFrame: (tile: KeyframeTile | null) => void;
  clearStartFrame: () => void;
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

const areGenerationParamsEqual = (left: CapabilityValues, right: CapabilityValues): boolean => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
};

const areKeyframeTilesEqual = (
  left: KeyframeTile | null | undefined,
  right: KeyframeTile | null | undefined
): boolean => {
  if (left === right) return true;
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.id !== right.id) return false;
  if (left.url !== right.url) return false;
  if (left.source !== right.source) return false;
  if (left.assetId !== right.assetId) return false;
  if (left.sourcePrompt !== right.sourcePrompt) return false;
  if (left.storagePath !== right.storagePath) return false;
  if (left.viewUrlExpiresAt !== right.viewUrlExpiresAt) return false;
  return true;
};

const areKeyframesEqual = (left: KeyframeTile[], right: KeyframeTile[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftFrame = left[index];
    const rightFrame = right[index];
    if (!areKeyframeTilesEqual(leftFrame, rightFrame)) return false;
  }
  return true;
};

const normalizeStartFrameIdentityUrl = (url: string | null | undefined): string | null => {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const hashStripped = trimmed.split('#')[0] ?? trimmed;
    return hashStripped.split('?')[0] ?? hashStripped;
  }
};

const resolveStartFrameIdentity = (frame: KeyframeTile | null): string | null => {
  if (!frame) return null;
  const normalizedUrl = normalizeStartFrameIdentityUrl(frame.url);
  if (normalizedUrl) return normalizedUrl;

  const storagePath = frame.storagePath?.trim();
  if (storagePath) return `storage:${storagePath}`;
  const assetId = frame.assetId?.trim();
  if (assetId) return `asset:${assetId}`;
  return null;
};

const reconcileMotionAfterStartFrame = (
  state: GenerationControlsState,
  nextStartFrame: KeyframeTile | null
): Pick<GenerationControlsState['domain'], 'cameraMotion' | 'subjectMotion'> => {
  const previousIdentity = resolveStartFrameIdentity(state.domain.startFrame);
  const nextIdentity = resolveStartFrameIdentity(nextStartFrame);

  if (!nextIdentity) {
    if (!previousIdentity) {
      return {
        cameraMotion: state.domain.cameraMotion,
        subjectMotion: state.domain.subjectMotion,
      };
    }
    return { cameraMotion: null, subjectMotion: '' };
  }

  if (!previousIdentity) {
    return {
      cameraMotion: state.domain.cameraMotion,
      subjectMotion: state.domain.subjectMotion,
    };
  }

  if (previousIdentity !== nextIdentity) {
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
      if (areGenerationParamsEqual(state.domain.generationParams, action.value)) return state;
      return {
        ...state,
        domain: { ...state.domain, generationParams: action.value },
      };
    case 'mergeGenerationParams': {
      const hasChanges = Object.keys(action.value).some(
        (key) => !Object.is(state.domain.generationParams[key], action.value[key])
      );
      if (!hasChanges) return state;
      return {
        ...state,
        domain: {
          ...state.domain,
          generationParams: { ...state.domain.generationParams, ...action.value },
        },
      };
    }
    case 'setVideoTier':
      if (state.domain.videoTier === action.value) return state;
      return {
        ...state,
        domain: { ...state.domain, videoTier: action.value },
      };
    case 'setStartFrame': {
      const nextStartFrame = action.value;
      if (areKeyframeTilesEqual(state.domain.startFrame, nextStartFrame)) return state;
      const motion = reconcileMotionAfterStartFrame(state, nextStartFrame);
      return {
        ...state,
        domain: {
          ...state.domain,
          startFrame: nextStartFrame,
          ...motion,
        },
      };
    }
    case 'clearStartFrame': {
      if (!state.domain.startFrame) return state;
      const motion = reconcileMotionAfterStartFrame(state, null);
      return {
        ...state,
        domain: {
          ...state.domain,
          startFrame: null,
          ...motion,
        },
      };
    }
    case 'setKeyframes': {
      const nextKeyframes = normalizeKeyframes(action.value);
      if (areKeyframesEqual(state.domain.keyframes, nextKeyframes)) return state;
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
        },
      };
    }
    case 'addKeyframe': {
      if (state.domain.keyframes.length >= MAX_KEYFRAMES) return state;
      const nextKeyframes = [
        ...state.domain.keyframes,
        { id: createKeyframeId(), ...action.value },
      ];
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
        },
      };
    }
    case 'removeKeyframe': {
      const nextKeyframes = state.domain.keyframes.filter((tile) => tile.id !== action.value);
      if (nextKeyframes.length === state.domain.keyframes.length) return state;
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: nextKeyframes,
        },
      };
    }
    case 'clearKeyframes': {
      if (state.domain.keyframes.length === 0) return state;
      return {
        ...state,
        domain: {
          ...state.domain,
          keyframes: [],
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
      setStartFrame: (value) => dispatch({ type: 'setStartFrame', value }),
      clearStartFrame: () => dispatch({ type: 'clearStartFrame' }),
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
