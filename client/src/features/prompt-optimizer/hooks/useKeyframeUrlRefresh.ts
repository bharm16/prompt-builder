import { useCallback, useEffect, useRef } from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { logger } from '@/services/LoggingService';
import { resolveMediaUrl } from '@/services/media/MediaUrlResolver';
import {
  extractStorageObjectPath,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from '../context/GenerationControlsStore';

const log = logger.child('useKeyframeUrlRefresh');
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

export function useKeyframeUrlRefresh(): void {
  const { domain } = useGenerationControlsStoreState();
  const { setKeyframes, setStartFrame } = useGenerationControlsStoreActions();
  const keyframes = domain.keyframes;
  const startFrame = domain.startFrame;

  const keyframesRef = useRef<KeyframeTile[]>(keyframes);
  const startFrameRef = useRef<KeyframeTile | null>(startFrame);
  const refreshInFlightRef = useRef<Set<string>>(new Set());
  const lastRefreshSignatureRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    keyframesRef.current = keyframes;
  }, [keyframes]);

  useEffect(() => {
    startFrameRef.current = startFrame;
  }, [startFrame]);

  const updateKeyframe = useCallback(
    (frame: KeyframeTile, nextUrl: string, storagePath: string, expiresAt?: string): void => {
      const current = keyframesRef.current;
      let changed = false;
      const next = current.map((tile) => {
        if (tile.id !== frame.id) return tile;
        const updated: KeyframeTile = {
          ...tile,
          url: nextUrl,
          storagePath,
          ...(expiresAt ? { viewUrlExpiresAt: expiresAt } : {}),
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

      if (!changed) return;
      keyframesRef.current = next;
      setKeyframes(next);
    },
    [setKeyframes]
  );

  const updateStartFrame = useCallback(
    (frame: KeyframeTile, nextUrl: string, storagePath: string, expiresAt?: string): void => {
      const current = startFrameRef.current;
      if (!current || current.id !== frame.id) return;
      const updated: KeyframeTile = {
        ...current,
        url: nextUrl,
        storagePath,
        ...(expiresAt ? { viewUrlExpiresAt: expiresAt } : {}),
      };
      if (
        updated.url === current.url &&
        updated.storagePath === current.storagePath &&
        updated.viewUrlExpiresAt === current.viewUrlExpiresAt
      ) {
        return;
      }
      startFrameRef.current = updated;
      setStartFrame(updated);
    },
    [setStartFrame]
  );

  const refreshStaleKeyframes = useCallback(async () => {
    const refreshFrame = async (
      frame: KeyframeTile,
      refreshKey: string,
      onUpdate: (input: KeyframeTile, nextUrl: string, storagePath: string, expiresAt?: string) => void
    ): Promise<void> => {
      const storagePath = frame.storagePath || extractStorageObjectPath(frame.url || '');
      if (!storagePath) return;

      const expiresAtMs =
        parseExpiresAtMs(frame.viewUrlExpiresAt) ?? parseGcsSignedUrlExpiryMs(frame.url || '');
      const needsRefresh = shouldRefreshUrl(
        frame.url ?? null,
        expiresAtMs,
        refreshKey,
        lastRefreshSignatureRef.current
      );
      if (!needsRefresh) return;
      if (refreshInFlightRef.current.has(refreshKey)) return;

      refreshInFlightRef.current.add(refreshKey);
      try {
        const result = await resolveMediaUrl({
          kind: 'image',
          url: frame.url ?? null,
          storagePath,
          preferFresh: true,
        });
        const nextUrl = result.url;
        if (!nextUrl) return;
        onUpdate(frame, nextUrl, storagePath, result.expiresAt ?? undefined);
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
    };

    const frames = keyframesRef.current;
    if (frames.length) {
      await Promise.all(
        frames.map((frame) => refreshFrame(frame, frame.id, updateKeyframe))
      );
    }

    const latestStartFrame = startFrameRef.current;
    if (latestStartFrame) {
      await refreshFrame(latestStartFrame, 'start-frame', updateStartFrame);
    }
  }, [updateKeyframe, updateStartFrame]);

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
  }, [refreshStaleKeyframes, keyframes.length, startFrame?.id, startFrame?.url]);
}
