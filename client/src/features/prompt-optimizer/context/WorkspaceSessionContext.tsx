import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SessionDto } from '@shared/types/session';
import type { ContinuitySession, ContinuityShot, CreateShotInput, UpdateShotInput } from '@/features/continuity/types';
import { continuityApi } from '@/features/continuity/api/continuityApi';
import { apiClient } from '@/services/ApiClient';

interface StartSequenceInput {
  sourceVideoId: string;
  prompt?: string;
  name?: string;
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
  startSequence: (input: StartSequenceInput) => Promise<ContinuityShot>;
  isStartingSequence: boolean;
}

const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | null>(null);

const mapContinuityToSession = (continuity: ContinuitySession): SessionDto['continuity'] => ({
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

  const refreshSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/v2/sessions/${encodeURIComponent(sessionId)}`);
      const data = (response as { data?: SessionDto }).data ?? null;
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
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

  const isSequenceMode = orderedShots.length > 0;

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
      const shot = await continuityApi.addShot(sessionId, input);
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
      const shot = await continuityApi.updateShot(sessionId, shotId, updates);
      updateShotInState(shot);
      return shot;
    },
    [sessionId, updateShotInState]
  );

  const updateShotStyleReference = useCallback(
    async (shotId: string, styleReferenceId: string | null): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      const shot = await continuityApi.updateShotStyleReference(sessionId, shotId, styleReferenceId);
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
        const shot = await continuityApi.generateShot(sessionId, shotId);
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
    async ({ sourceVideoId, prompt, name }: StartSequenceInput): Promise<ContinuityShot> => {
      if (!sessionId) throw new Error('No active session');
      if (!sourceVideoId) throw new Error('Missing source video');
      if (isStartingSequence) throw new Error('Sequence creation in progress');

      setIsStartingSequence(true);
      try {
        let continuityPayload = session?.continuity ?? null;
        if (!session?.continuity) {
          const resolvedName = name ?? session?.name ?? 'Continuity Session';
          const safeName = resolvedName.trim() ? resolvedName : 'Continuity Session';
          const continuitySession = await continuityApi.createSession({
            sessionId,
            name: safeName,
            sourceVideoId,
          });
          continuityPayload = mapContinuityToSession(continuitySession);
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  continuity: continuityPayload,
                }
              : prev
          );
        }

        const shotPrompt = prompt?.trim() || ' ';
        const shot = await continuityApi.addShot(sessionId, {
          prompt: shotPrompt,
          sourceVideoId,
        });
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
        return shot;
      } finally {
        setIsStartingSequence(false);
      }
    },
    [isStartingSequence, session, sessionId, updateShotInState]
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
