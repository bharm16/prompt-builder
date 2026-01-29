import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContinuitySession, ContinuityShot, CreateSessionInput, CreateShotInput } from '../types';
import { continuityApi } from '../api/continuityApi';

interface ContinuitySessionContextValue {
  session: ContinuitySession | null;
  loading: boolean;
  error?: string | null;
  loadSession: (sessionId: string) => Promise<void>;
  createSession: (input: CreateSessionInput) => Promise<ContinuitySession>;
  addShot: (input: CreateShotInput) => Promise<ContinuityShot>;
  generateShot: (shotId: string) => Promise<ContinuityShot>;
  updateStyleReference: (shotId: string, styleReferenceId: string | null) => Promise<ContinuityShot>;
  updatePrimaryStyleReference: (input: Record<string, unknown>) => Promise<ContinuitySession>;
  updateSessionSettings: (settings: Record<string, unknown>) => Promise<ContinuitySession>;
  createSceneProxy: (input: Record<string, unknown>) => Promise<void>;
}

const ContinuitySessionContext = createContext<ContinuitySessionContextValue | null>(null);

export function useContinuitySession(): ContinuitySessionContextValue {
  const context = useContext(ContinuitySessionContext);
  if (!context) {
    throw new Error('useContinuitySession must be used within ContinuitySessionProvider');
  }
  return context;
}

export function ContinuitySessionProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [session, setSession] = useState<ContinuitySession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await continuityApi.getSession(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (input: CreateSessionInput) => {
    setLoading(true);
    setError(null);
    try {
      const data = await continuityApi.createSession(input);
      setSession(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const addShot = useCallback(async (input: CreateShotInput) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.addShot(session.id, input);
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, shots: [...prev.shots, shot] };
    });
    return shot;
  }, [session]);

  const generateShot = useCallback(async (shotId: string) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.generateShot(session.id, shotId);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shots: prev.shots.map((s) => (s.id === shot.id ? shot : s)),
      };
    });
    return shot;
  }, [session]);

  const updateStyleReference = useCallback(async (shotId: string, styleReferenceId: string | null) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.updateShotStyleReference(session.id, shotId, styleReferenceId);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shots: prev.shots.map((s) => (s.id === shot.id ? shot : s)),
      };
    });
    return shot;
  }, [session]);

  const createSceneProxy = useCallback(async (input: Record<string, unknown>) => {
    if (!session) throw new Error('No active session');
    const updated = await continuityApi.createSceneProxy(session.id, input);
    setSession(updated);
  }, [session]);

  const updateSessionSettings = useCallback(async (settings: Record<string, unknown>) => {
    if (!session) throw new Error('No active session');
    const updated = await continuityApi.updateSessionSettings(session.id, settings);
    setSession(updated);
    return updated;
  }, [session]);

  const updatePrimaryStyleReference = useCallback(async (input: Record<string, unknown>) => {
    if (!session) throw new Error('No active session');
    const updated = await continuityApi.updatePrimaryStyleReference(session.id, input);
    setSession(updated);
    return updated;
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      loading,
      error,
      loadSession,
      createSession,
      addShot,
      generateShot,
      updateStyleReference,
      updatePrimaryStyleReference,
      updateSessionSettings,
      createSceneProxy,
    }),
    [
      session,
      loading,
      error,
      loadSession,
      createSession,
      addShot,
      generateShot,
      updateStyleReference,
      updatePrimaryStyleReference,
      updateSessionSettings,
      createSceneProxy,
    ]
  );

  return (
    <ContinuitySessionContext.Provider value={value}>
      {children}
    </ContinuitySessionContext.Provider>
  );
}
