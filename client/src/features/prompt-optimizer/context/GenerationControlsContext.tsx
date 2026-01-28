import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { DraftModel, KeyframeTile } from '@components/ToolSidebar/types';
import type { CameraPath } from '@/features/convergence/types';
import { logger } from '@/services/LoggingService';

const log = logger.child('GenerationControlsContext');

export interface GenerationControlsHandlers {
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  onStoryboard: () => void;
  isGenerating: boolean;
  activeDraftModel: string | null;
}

interface GenerationControlsContextValue {
  controls: GenerationControlsHandlers | null;
  setControls: (controls: GenerationControlsHandlers | null) => void;
  keyframes: KeyframeTile[];
  addKeyframe: (tile: Omit<KeyframeTile, 'id'>) => void;
  removeKeyframe: (id: string) => void;
  clearKeyframes: () => void;
  onStoryboard: (() => void) | null;
  cameraMotion: CameraPath | null;
  subjectMotion: string;
  setCameraMotion: (cameraPath: CameraPath | null) => void;
  setSubjectMotion: (motion: string) => void;
}

const GenerationControlsContext = createContext<GenerationControlsContextValue | null>(null);

export function GenerationControlsProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [controls, setControls] = useState<GenerationControlsHandlers | null>(null);
  const [keyframes, setKeyframes] = useState<KeyframeTile[]>([]);
  const [cameraMotion, setCameraMotionState] = useState<CameraPath | null>(null);
  const [subjectMotion, setSubjectMotionState] = useState('');
  const lastFirstKeyframeUrlRef = useRef<string | null>(null);
  const subjectMotionLogBucketRef = useRef<number>(0);

  const safeUrlHost = (url: unknown): string | null => {
    if (typeof url !== 'string' || url.trim().length === 0) {
      return null;
    }
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  const addKeyframe = useCallback((tile: Omit<KeyframeTile, 'id'>): void => {
    setKeyframes((prev) => {
      if (prev.length >= 3) {
        log.warn('Keyframe add ignored because limit was reached', {
          previousCount: prev.length,
          limit: 3,
        });
        return prev;
      }
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...prev, { id, ...tile }];
      log.info('Keyframe added in generation controls context', {
        previousCount: prev.length,
        nextCount: next.length,
        primaryKeyframeUrlHost: safeUrlHost(next[0]?.url),
        addedKeyframeUrlHost: safeUrlHost(tile.url),
      });
      return next;
    });
  }, []);

  const removeKeyframe = useCallback((id: string): void => {
    setKeyframes((prev) => {
      const next = prev.filter((tile) => tile.id !== id);
      log.info('Keyframe removed in generation controls context', {
        removedKeyframeId: id,
        previousCount: prev.length,
        nextCount: next.length,
        previousPrimaryKeyframeUrlHost: safeUrlHost(prev[0]?.url),
        nextPrimaryKeyframeUrlHost: safeUrlHost(next[0]?.url),
      });
      return next;
    });
  }, []);

  const clearKeyframes = useCallback((): void => {
    setKeyframes((prev) => {
      if (prev.length > 0) {
        log.info('Keyframes cleared in generation controls context', {
          previousCount: prev.length,
          hadCameraMotion: Boolean(cameraMotion?.id),
          subjectMotionLength: subjectMotion.trim().length,
        });
      }
      return [];
    });
  }, [cameraMotion?.id, subjectMotion]);

  const setCameraMotion = useCallback((nextCameraMotion: CameraPath | null): void => {
    setCameraMotionState((previousCameraMotion) => {
      if (previousCameraMotion?.id === nextCameraMotion?.id) {
        return previousCameraMotion;
      }

      log.info('Camera motion updated in generation controls context', {
        previousCameraMotionId: previousCameraMotion?.id ?? null,
        nextCameraMotionId: nextCameraMotion?.id ?? null,
        nextCameraMotionLabel: nextCameraMotion?.label ?? null,
      });

      return nextCameraMotion;
    });
  }, []);

  const setSubjectMotion = useCallback((nextSubjectMotion: string): void => {
    setSubjectMotionState((previousSubjectMotion) => {
      const previousLength = previousSubjectMotion.trim().length;
      const nextLength = nextSubjectMotion.trim().length;
      const nextBucket = Math.floor(nextLength / 20);
      const bucketChanged = nextBucket !== subjectMotionLogBucketRef.current;
      const becameEmpty = previousLength > 0 && nextLength === 0;
      const becameNonEmpty = previousLength === 0 && nextLength > 0;

      if (bucketChanged || becameEmpty || becameNonEmpty) {
        subjectMotionLogBucketRef.current = nextBucket;
        log.debug('Subject motion updated in generation controls context', {
          previousLength,
          nextLength,
          becameEmpty,
          becameNonEmpty,
        });
      }

      return nextSubjectMotion;
    });
  }, []);

  const firstKeyframeUrl = keyframes[0]?.url ?? null;

  useEffect(() => {
    if (!firstKeyframeUrl) {
      lastFirstKeyframeUrlRef.current = null;
      if (cameraMotion !== null) {
        log.info('Clearing camera motion because no primary keyframe is available', {
          previousCameraMotionId: cameraMotion.id,
          keyframesCount: keyframes.length,
        });
        setCameraMotionState(null);
      }
      if (subjectMotion.trim()) {
        log.info('Clearing subject motion because no primary keyframe is available', {
          subjectMotionLength: subjectMotion.trim().length,
        });
        subjectMotionLogBucketRef.current = 0;
        setSubjectMotionState('');
      }
      return;
    }

    if (lastFirstKeyframeUrlRef.current === null) {
      lastFirstKeyframeUrlRef.current = firstKeyframeUrl;
      log.debug('Primary keyframe established for motion controls', {
        primaryKeyframeUrlHost: safeUrlHost(firstKeyframeUrl),
        keyframesCount: keyframes.length,
      });
      return;
    }

    if (lastFirstKeyframeUrlRef.current !== firstKeyframeUrl) {
      const previousUrl = lastFirstKeyframeUrlRef.current;
      lastFirstKeyframeUrlRef.current = firstKeyframeUrl;
      log.info('Primary keyframe changed; clearing motion selections', {
        previousPrimaryKeyframeUrlHost: safeUrlHost(previousUrl),
        nextPrimaryKeyframeUrlHost: safeUrlHost(firstKeyframeUrl),
        previousCameraMotionId: cameraMotion?.id ?? null,
        subjectMotionLength: subjectMotion.trim().length,
      });
      setCameraMotionState(null);
      if (subjectMotion.trim()) {
        subjectMotionLogBucketRef.current = 0;
        setSubjectMotionState('');
      }
    }
  }, [firstKeyframeUrl, cameraMotion, subjectMotion, keyframes.length]);

  const onStoryboard = useMemo(() => controls?.onStoryboard ?? null, [controls]);

  return (
    <GenerationControlsContext.Provider
      value={{
        controls,
        setControls,
        keyframes,
        addKeyframe,
        removeKeyframe,
        clearKeyframes,
        onStoryboard,
        cameraMotion,
        subjectMotion,
        setCameraMotion,
        setSubjectMotion,
      }}
    >
      {children}
    </GenerationControlsContext.Provider>
  );
}

export function useGenerationControlsContext(): GenerationControlsContextValue {
  const context = useContext(GenerationControlsContext);
  if (!context) {
    throw new Error('useGenerationControlsContext must be used within GenerationControlsProvider');
  }
  return context;
}
