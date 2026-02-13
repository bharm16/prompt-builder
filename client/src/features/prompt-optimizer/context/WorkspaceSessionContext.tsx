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
import type { SessionDto } from '@shared/types/session';
import type { ContinuitySession, ContinuityShot, CreateShotInput, UpdateShotInput } from '@/features/continuity/types';
import { continuityApi } from '@/features/continuity/api/continuityApi';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/services/LoggingService';

interface StartSequenceInput {
  sourceVideoId: string;
  sourceImageUrl?: string;
  prompt?: string;
  name?: string;
  originSessionId?: string;
}

interface StartSequenceResult {
  sessionId: string;
  shot: ContinuityShot;
}

interface WorkspaceSessionContextValue {
  session: SessionDto | null;
  loading: boolean;
  error: string | null;
  isSequenceMode: boolean;
  shots: ContinuityShot[];
  currentShotId: string | null;
  currentShot: ContinuityShot | null;
  currentShotIndex: number;
  setCurrentShotId: (shotId: string | null) => void;
  refreshSession: () => Promise<void>;
  addShot: (input: CreateShotInput) => Promise<ContinuityShot>;
  updateShot: (shotId: string, updates: UpdateShotInput) => Promise<ContinuityShot>;
  updateShotStyleReference: (shotId: string, styleReferenceId: string | null) => Promise<ContinuityShot>;
  generateShot: (shotId: string) => Promise<ContinuityShot>;
  startSequence: (input: StartSequenceInput) => Promise<StartSequenceResult>;
  isStartingSequence: boolean;
}

const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | null>(null);
const log = logger.child('WorkspaceSessionContext');

const mapContinuityToSession = (
  continuity: ContinuitySession
): NonNullable<SessionDto['continuity']> => ({
  shots: continuity.shots,
  primaryStyleReference: continuity.primaryStyleReference ?? null,
  sceneProxy: continuity.sceneProxy ?? null,
  settings: continuity.defaultSettings,
});

export function useWorkspaceSession(): WorkspaceSessionContextValue {
  const context = useContext(WorkspaceSessionContext);
  if (!context) {
    throw new Error('useWorkspaceSession must be used within WorkspaceSessionProvider');
  }
  return context;
}

export function WorkspaceSessionProvider({
  sessionId,
  children,
}: {
  sessionId?: string;
  children: ReactNode;
}): React.ReactElement {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentShotId, setCurrentShotId] = useState<string | null>(null);
  const [isStartingSequence, setIsStartingSequence] = useState(false);
  const routeSessionIdRef = useRef<string | undefined>(sessionId);
  const refreshRequestIdRef = useRef(0);

  useEffect(() => {
    routeSessionIdRef.current = sessionId;
  }, [sessionId]);

  const refreshSession = useCallback(async () => {
    const requestedSessionId = sessionId;
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    if (!requestedSessionId) {
      setSession(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/v2/sessions/${encodeURIComponent(requestedSessionId)}`);
      if (
        refreshRequestIdRef.current !== requestId ||
        routeSessionIdRef.current !== requestedSessionId
      ) {
        return;
      }
      const data = (response as { data?: SessionDto }).data ?? null;
      setSession(data);
    } catch (err) {
      if (
        refreshRequestIdRef.current !== requestId ||
        routeSessionIdRef.current !== requestedSessionId
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (
        refreshRequestIdRef.current === requestId &&
        routeSessionIdRef.current === requestedSessionId
      ) {
        setLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    setSession((prev) => {
      if (!sessionId) return null;
      return prev?.id === sessionId ? prev : null;
    });
    setError(null);
    setCurrentShotId(null);
  }, [sessionId]);

  const shots = useMemo<ContinuityShot[]>(
    () => session?.continuity?.shots ?? [],
    [session?.continuity?.shots]
  );

  const orderedShots = useMemo(
    () => [...shots].sort((a, b) => a.sequenceIndex - b.sequenceIndex),
    [shots]
  );

  // A session can contain continuity data and still be a prompt workspace.
  // Only continuity-only sessions should force sequence UI mode.
  const isSequenceMode = orderedShots.length > 0 && !session?.prompt;

  const currentShot = useMemo(() => {
    if (!currentShotId) return null;
    return orderedShots.find((shot) => shot.id === currentShotId) ?? null;
  }, [currentShotId, orderedShots]);

  const currentShotIndex = useMemo(() => {
    if (!currentShotId) return -1;
    return orderedShots.findIndex((shot) => shot.id === currentShotId);
  }, [currentShotId, orderedShots]);

  useEffect(() => {
    if (!isSequenceMode) {
      if (currentShotId) setCurrentShotId(null);
      return;
    }
    if (currentShotId && orderedShots.some((shot) => shot.id === currentShotId)) {
      return;
    }
    const lastShot = orderedShots[orderedShots.length - 1];
    setCurrentShotId(lastShot?.id ?? null);
  }, [currentShotId, isSequenceMode, orderedShots]);

  const updateShotInState = useCallback((shot: ContinuityShot) => {
    setSession((prev) => {
      if (!prev?.continuity) return prev;
      const nextShots = prev.continuity.shots.map((existing) =>
        existing.id === shot.id ? shot : existing
      );
      if (!nextShots.some((existing) => existing.id === shot.id)) {
        nextShots.push(shot);
      }
      return {
        ...prev,
        continuity: {
          ...prev.continuity,
          shots: nextShots,
        },
      };
    });
  }, []);

  const patchShotInState = useCallback((shotId: string, updates: Partial<ContinuityShot>) => {
    setSession((prev) => {
      if (!prev?.continuity) return prev;
      const nextShots = prev.continuity.shots.map((existing) =>
        existing.id === shotId ? { ...existing, ...updates } : existing
      );
      return {
        ...prev,
        continuity: {
          ...prev.continuity,
          shots: nextShots,
        },
      };
    });
  }, []);

  const addShot = useCallback(
    async (input: CreateShotInput): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      const shot = (await continuityApi.addShot(sessionId, input)) as ContinuityShot;
      setSession((prev) => {
        if (!prev?.continuity) return prev;
        return {
          ...prev,
          continuity: {
            ...prev.continuity,
            shots: [...prev.continuity.shots, shot],
          },
        };
      });
      return shot;
    },
    [sessionId]
  );

  const updateShot = useCallback(
    async (shotId: string, updates: UpdateShotInput): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      const shot = (await continuityApi.updateShot(sessionId, shotId, updates)) as ContinuityShot;
      updateShotInState(shot);
      return shot;
    },
    [sessionId, updateShotInState]
  );

  const updateShotStyleReference = useCallback(
    async (shotId: string, styleReferenceId: string | null): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      const shot = (await continuityApi.updateShotStyleReference(
        sessionId,
        shotId,
        styleReferenceId
      )) as ContinuityShot;
      updateShotInState(shot);
      return shot;
    },
    [sessionId, updateShotInState]
  );

  const generateShot = useCallback(
    async (shotId: string): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      patchShotInState(shotId, { status: 'generating-video', error: undefined });
      try {
        const shot = (await continuityApi.generateShot(sessionId, shotId)) as ContinuityShot;
        updateShotInState(shot);
        return shot;
      } catch (error) {
        patchShotInState(shotId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Shot generation failed',
        });
        throw error;
      }
    },
    [sessionId, patchShotInState, updateShotInState]
  );

  const startSequence = useCallback(
    async ({
      sourceVideoId,
      sourceImageUrl,
      prompt,
      name,
      originSessionId,
    }: StartSequenceInput): Promise<StartSequenceResult> => {
      const routeSessionIdAtStart = sessionId ?? null;
      const isCurrentRouteSessionLoaded =
        Boolean(routeSessionIdAtStart) && session?.id === routeSessionIdAtStart;
      const activeSessionId = routeSessionIdAtStart ?? originSessionId ?? session?.id ?? null;
      if (!sourceVideoId) {
        log.error('Cannot start sequence without a source video id', undefined, {
          routeSessionId: sessionId ?? null,
          originSessionId: originSessionId ?? null,
        });
        throw new Error('Missing source video');
      }
      if (isStartingSequence) {
        log.warn('Sequence creation already in progress', {
          routeSessionId: sessionId ?? null,
          originSessionId: originSessionId ?? null,
          sourceVideoId,
        });
        throw new Error('Sequence creation in progress');
      }

      setIsStartingSequence(true);
      try {
        let targetSessionId = activeSessionId;
        let continuityPayload: NonNullable<SessionDto['continuity']> | null =
          isCurrentRouteSessionLoaded ? session?.continuity ?? null : null;
        const canReuseCurrentContinuitySession =
          Boolean(activeSessionId) &&
          isCurrentRouteSessionLoaded &&
          Boolean(session?.continuity) &&
          !session?.prompt &&
          routeSessionIdAtStart === activeSessionId;

        if (!canReuseCurrentContinuitySession) {
          const resolvedName =
            name ??
            (isCurrentRouteSessionLoaded ? session?.name : undefined) ??
            'Continuity Session';
          const safeName = resolvedName.trim() ? resolvedName : 'Continuity Session';
          const continuitySession = await continuityApi.createSession({
            name: safeName,
            sourceVideoId,
            ...(typeof sourceImageUrl === 'string' && sourceImageUrl.trim()
              ? { sourceImageUrl: sourceImageUrl.trim() }
              : {}),
          });
          const createdContinuity = mapContinuityToSession(continuitySession);
          targetSessionId = continuitySession.id;
          continuityPayload = createdContinuity;
          if (
            targetSessionId === routeSessionIdAtStart &&
            routeSessionIdRef.current === routeSessionIdAtStart
          ) {
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    continuity: createdContinuity,
                  }
                : prev
            );
          }
        }

        if (!targetSessionId) {
          throw new Error('Failed to create continuity session');
        }

        const requestedPrompt = prompt?.trim();
        const sessionPrompt = isCurrentRouteSessionLoaded ? session?.prompt?.input?.trim() : null;
        const activeShotPrompt = isCurrentRouteSessionLoaded ? currentShot?.userPrompt?.trim() : null;
        const shotPrompt =
          requestedPrompt || sessionPrompt || activeShotPrompt || 'Continue the scene';
        const shot = (await continuityApi.addShot(targetSessionId, {
          prompt: shotPrompt,
          sourceVideoId,
        })) as ContinuityShot;
        if (
          targetSessionId === routeSessionIdAtStart &&
          routeSessionIdRef.current === routeSessionIdAtStart
        ) {
          setSession((prev) => {
            if (!prev) return prev;
            const baseContinuity = prev.continuity ?? continuityPayload;
            if (!baseContinuity) return prev;
            return {
              ...prev,
              continuity: {
                ...baseContinuity,
                shots: [...(baseContinuity.shots ?? []), shot],
              },
            };
          });
          setCurrentShotId(shot.id);
        }
        log.info('Sequence started', {
          sourceVideoId,
          targetSessionId,
          routeSessionId: sessionId ?? null,
          originSessionId: originSessionId ?? null,
          shotId: shot.id,
        });
        return { sessionId: targetSessionId, shot };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error('Failed to start sequence', err, {
          sourceVideoId,
          activeSessionId,
          routeSessionId: sessionId ?? null,
          originSessionId: originSessionId ?? null,
        });
        throw error;
      } finally {
        setIsStartingSequence(false);
      }
    },
    [currentShot, isStartingSequence, session, sessionId]
  );

  const value = useMemo(
    () => ({
      session,
      loading,
      error,
      isSequenceMode,
      shots: orderedShots,
      currentShotId,
      currentShot,
      currentShotIndex,
      setCurrentShotId,
      refreshSession,
      addShot,
      updateShot,
      updateShotStyleReference,
      generateShot,
      startSequence,
      isStartingSequence,
    }),
    [
      session,
      loading,
      error,
      isSequenceMode,
      orderedShots,
      currentShotId,
      currentShot,
      currentShotIndex,
      setCurrentShotId,
      refreshSession,
      addShot,
      updateShot,
      updateShotStyleReference,
      generateShot,
      startSequence,
      isStartingSequence,
    ]
  );

  return <WorkspaceSessionContext.Provider value={value}>{children}</WorkspaceSessionContext.Provider>;
}

export default WorkspaceSessionContext;
