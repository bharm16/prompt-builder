import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContinuitySession, ContinuityShot } from '../types';
import { continuityApi } from '../api/continuityApi';

interface ContinuitySessionContextValue {
  session: ContinuitySession | null;
  loading: boolean;
  error?: string | null;
  loadSession: (sessionId: string) => Promise<void>;
  createSession: (input: Record<string, unknown>) => Promise<ContinuitySession>;
  addShot: (input: Record<string, unknown>) => Promise<ContinuityShot>;
  generateShot: (shotId: string) => Promise<ContinuityShot>;
  updateStyleReference: (shotId: string, styleReferenceId: string) => Promise<ContinuityShot>;
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

  const loadSession = async (sessionId: string) => {
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
  };

  const createSession = async (input: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const data = await continuityApi.createSession(input);
      setSession(data);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const addShot = async (input: Record<string, unknown>) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.addShot(session.id, input);
    setSession({ ...session, shots: [...session.shots, shot] });
    return shot;
  };

  const generateShot = async (shotId: string) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.generateShot(session.id, shotId);
    setSession({
      ...session,
      shots: session.shots.map((s) => (s.id === shot.id ? shot : s)),
    });
    return shot;
  };

  const updateStyleReference = async (shotId: string, styleReferenceId: string) => {
    if (!session) throw new Error('No active session');
    const shot = await continuityApi.updateShotStyleReference(session.id, shotId, styleReferenceId);
    setSession({
      ...session,
      shots: session.shots.map((s) => (s.id === shot.id ? shot : s)),
    });
    return shot;
  };

  const createSceneProxy = async (input: Record<string, unknown>) => {
    if (!session) throw new Error('No active session');
    const updated = await continuityApi.createSceneProxy(session.id, input);
    setSession(updated);
  };

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
      createSceneProxy,
    }),
    [session, loading, error]
  );

  return (
    <ContinuitySessionContext.Provider value={value}>
      {children}
    </ContinuitySessionContext.Provider>
  );
}
