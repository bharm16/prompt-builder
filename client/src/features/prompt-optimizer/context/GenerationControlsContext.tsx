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
import { storageApi } from '@/api/storageApi';
import {
  extractStorageObjectPath,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';
import { safeUrlHost } from '@/utils/url';
import {
  loadCameraMotion,
  loadKeyframes,
  loadSubjectMotion,
  persistCameraMotion,
  persistKeyframes,
  persistSubjectMotion,
} from './generationControlsStorage';

const log = logger.child('GenerationControlsContext');
const KEYFRAME_REFRESH_INTERVAL_MS = 60 * 1000;
const KEYFRAME_REFRESH_BUFFER_MS = 2 * 60 * 1000;

const parseExpiresAtMs = (value?: string | null): number | null => {
  if (!value || typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shouldRefreshUrl = (
  url: string | null,
  expiresAtMs: number | null,
  key: string,
  lastRefreshSignature: Map<string, string>
): boolean => {
  if (!url || typeof url !== 'string') return true;
  if (expiresAtMs !== null) {
    return Date.now() >= expiresAtMs - KEYFRAME_REFRESH_BUFFER_MS;
  }
  if (hasGcsSignedUrlParams(url)) {
    return lastRefreshSignature.get(key) !== url;
  }
  return false;
};

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
  setKeyframes: (tiles: KeyframeTile[] | null | undefined) => void;
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
  const [keyframes, setKeyframesState] = useState<KeyframeTile[]>(() => loadKeyframes());
  const [cameraMotion, setCameraMotionState] = useState<CameraPath | null>(() => loadCameraMotion());
  const [subjectMotion, setSubjectMotionState] = useState(() => loadSubjectMotion());
  const lastFirstKeyframeUrlRef = useRef<string | null>(null);
  const subjectMotionLogBucketRef = useRef<number>(0);
  const hasHydratedKeyframesRef = useRef(false);

  const keyframesRef = useRef<KeyframeTile[]>([]);
  const refreshInFlightRef = useRef<Set<string>>(new Set());
  const lastRefreshSignatureRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    keyframesRef.current = keyframes;
  }, [keyframes]);

  useEffect(() => {
    persistCameraMotion(cameraMotion);
  }, [cameraMotion]);

  useEffect(() => {
    persistSubjectMotion(subjectMotion);
  }, [subjectMotion]);

  useEffect(() => {
    persistKeyframes(keyframes);
  }, [keyframes]);

  const refreshStaleKeyframes = useCallback(async () => {
    const frames = keyframesRef.current;
    if (!frames.length) return;

    await Promise.all(
      frames.map(async (frame) => {
        const storagePath = frame.storagePath || extractStorageObjectPath(frame.url || '');
        if (!storagePath) return;

        const expiresAtMs =
          parseExpiresAtMs(frame.viewUrlExpiresAt) ?? parseGcsSignedUrlExpiryMs(frame.url || '');
        const refreshKey = frame.id;
        const needsRefresh = shouldRefreshUrl(
          frame.url ?? null,
          expiresAtMs,
          refreshKey,
          lastRefreshSignatureRef.current
        );

        if (!needsRefresh) {
          return;
        }

        if (refreshInFlightRef.current.has(refreshKey)) return;
        refreshInFlightRef.current.add(refreshKey);

        try {
          const response = (await storageApi.getViewUrl(storagePath)) as { viewUrl: string; expiresAt?: string };
          const nextUrl = response?.viewUrl;
          if (!nextUrl) return;

          setKeyframesState((prev) => {
            let changed = false;
            const next = prev.map((tile) => {
              if (tile.id !== frame.id) return tile;
              const updated: KeyframeTile = {
                ...tile,
                url: nextUrl,
                storagePath,
                ...(response?.expiresAt ? { viewUrlExpiresAt: response.expiresAt } : {}),
              };
              if (
                updated.url !== tile.url ||
                updated.storagePath !== tile.storagePath ||
                updated.viewUrlExpiresAt !== tile.viewUrlExpiresAt
              ) {
                changed = true;
              }
              return updated;
            });
            return changed ? next : prev;
          });

          lastRefreshSignatureRef.current.set(refreshKey, nextUrl);
        } catch (error) {
          log.debug('Failed to refresh keyframe view URL', {
            keyframeId: frame.id,
            storagePath,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          refreshInFlightRef.current.delete(refreshKey);
        }
      })
    );
  }, [setKeyframesState]);

  useEffect(() => {
    let isActive = true;
    void refreshStaleKeyframes();
    const intervalId = setInterval(() => {
      if (!isActive) return;
      void refreshStaleKeyframes();
    }, KEYFRAME_REFRESH_INTERVAL_MS);
    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [refreshStaleKeyframes, keyframes.length]);

  const addKeyframe = useCallback((tile: Omit<KeyframeTile, 'id'>): void => {
    setKeyframesState((prev) => {
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
    hasHydratedKeyframesRef.current = true;
  }, []);

  const removeKeyframe = useCallback((id: string): void => {
    setKeyframesState((prev) => {
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
    hasHydratedKeyframesRef.current = true;
  }, []);

  const setKeyframes = useCallback((tiles: KeyframeTile[] | null | undefined): void => {
    const normalized = Array.isArray(tiles) ? tiles.slice(0, 3) : [];
    setKeyframesState(normalized);
    hasHydratedKeyframesRef.current = true;
    log.info('Keyframes set in generation controls context', {
      keyframesCount: normalized.length,
      primaryKeyframeUrlHost: safeUrlHost(normalized[0]?.url),
    });
  }, []);

  const clearKeyframes = useCallback((): void => {
    setKeyframesState((prev) => {
      if (prev.length > 0) {
        log.info('Keyframes cleared in generation controls context', {
          previousCount: prev.length,
          hadCameraMotion: Boolean(cameraMotion?.id),
          subjectMotionLength: subjectMotion.trim().length,
        });
      }
      return [];
    });
    hasHydratedKeyframesRef.current = true;
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
      if (!hasHydratedKeyframesRef.current) {
        return;
      }
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

  const contextValue = useMemo<GenerationControlsContextValue>(() => ({
    controls,
    setControls,
    keyframes,
    setKeyframes,
    addKeyframe,
    removeKeyframe,
    clearKeyframes,
    onStoryboard,
    cameraMotion,
    subjectMotion,
    setCameraMotion,
    setSubjectMotion,
  }), [
    controls,
    setControls,
    keyframes,
    setKeyframes,
    addKeyframe,
    removeKeyframe,
    clearKeyframes,
    onStoryboard,
    cameraMotion,
    subjectMotion,
    setCameraMotion,
    setSubjectMotion,
  ]);

  return (
    <GenerationControlsContext.Provider value={contextValue}>
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
