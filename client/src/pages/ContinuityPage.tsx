import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ContinuitySessionProvider,
  useContinuitySession,
} from '@/features/continuity';
import { ContinuitySessionView } from '@/features/continuity/components/ContinuitySession';
import { continuityApi } from '@/features/continuity/api/continuityApi';
import type {
  ContinuitySession,
  ContinuityMode,
  CreateSessionInput,
  GenerationMode,
} from '@/features/continuity/types';

function ContinuityLanding(): React.ReactElement {
  const navigate = useNavigate();
  const { createSession } = useContinuitySession();
  const [sessions, setSessions] = useState<ContinuitySession[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceVideoId, setSourceVideoId] = useState('');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('continuity');
  const [defaultContinuityMode, setDefaultContinuityMode] = useState<ContinuityMode>('frame-bridge');
  const [styleStrength, setStyleStrength] = useState(0.6);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setListLoading(true);
    continuityApi
      .listSessions()
      .then((data) => {
        if (!isMounted) return;
        setSessions(data);
      })
      .catch((error) => {
        if (!isMounted) return;
        setListError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!isMounted) return;
        setListLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      setCreateError('Session name is required.');
      return;
    }
    if (!sourceVideoId.trim() && !sourceImageUrl.trim()) {
      setCreateError('Provide a source video ID or source image URL.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const payload: CreateSessionInput = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(sourceVideoId.trim() ? { sourceVideoId: sourceVideoId.trim() } : {}),
        ...(sourceImageUrl.trim() ? { sourceImageUrl: sourceImageUrl.trim() } : {}),
        ...(initialPrompt.trim() ? { initialPrompt: initialPrompt.trim() } : {}),
        settings: {
          generationMode,
          defaultContinuityMode,
          defaultStyleStrength: styleStrength,
        },
      };

      const session = await createSession(payload);
      navigate(`/continuity/${session.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Scene Continuity</h1>
        <p className="text-sm text-muted">Create a continuity session from a source video or image.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-4">
          <h2 className="text-base font-semibold text-foreground">New Session</h2>
          {createError && (
            <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              {createError}
            </div>
          )}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Session name"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={sourceVideoId}
            onChange={(event) => setSourceVideoId(event.target.value)}
            placeholder="Source video asset ID"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
          <div className="text-center text-xs text-muted">or</div>
          <input
            type="text"
            value={sourceImageUrl}
            onChange={(event) => setSourceImageUrl(event.target.value)}
            placeholder="Source image URL"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
          <textarea
            value={initialPrompt}
            onChange={(event) => setInitialPrompt(event.target.value)}
            placeholder="Initial prompt (optional)"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted">Generation mode</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                value={generationMode}
                onChange={(event) => setGenerationMode(event.target.value as GenerationMode)}
              >
                <option value="continuity">Continuity</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Default continuity</label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                value={defaultContinuityMode}
                onChange={(event) => setDefaultContinuityMode(event.target.value as ContinuityMode)}
              >
                <option value="frame-bridge">Frame bridge</option>
                <option value="style-match">Style match</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Default style strength</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={styleStrength}
              onChange={(event) => setStyleStrength(Number(event.target.value))}
              className="mt-2 w-full accent-accent"
            />
            <div className="mt-1 text-xs text-muted">{styleStrength.toFixed(2)}</div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className={`w-full rounded-md px-4 py-2 text-sm font-medium ${
              isCreating ? 'bg-surface-3 text-muted cursor-not-allowed' : 'bg-accent text-white'
            }`}
          >
            {isCreating ? 'Creating...' : 'Create session'}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Your Sessions</h2>
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground"
              onClick={() => {
                setListLoading(true);
                setListError(null);
                continuityApi
                  .listSessions()
                  .then((data) => setSessions(data))
                  .catch((error) =>
                    setListError(error instanceof Error ? error.message : String(error))
                  )
                  .finally(() => setListLoading(false));
              }}
            >
              Refresh
            </button>
          </div>

          {listError && (
            <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              {listError}
            </div>
          )}

          {listLoading ? (
            <div className="text-sm text-muted">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-sm text-muted">No continuity sessions yet.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/continuity/${session.id}`}
                  className="block rounded-lg border border-border px-3 py-2 text-sm hover:border-border-strong"
                >
                  <div className="font-medium text-foreground">{session.name}</div>
                  <div className="text-xs text-muted">
                    Updated {new Date(session.updatedAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContinuityPageInner(): React.ReactElement {
  const { sessionId } = useParams();
  const { loadSession, session, loading, error } = useContinuitySession();

  useEffect(() => {
    if (sessionId) {
      void loadSession(sessionId);
    }
  }, [sessionId, loadSession]);

  if (!sessionId) {
    return <ContinuityLanding />;
  }

  if (loading) {
    return <div className="p-6">Loading continuity session...</div>;
  }

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <div className="text-red-500">{error}</div>
        <Link to="/continuity" className="text-sm text-accent">
          Create a new session
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <div>No session found.</div>
        <Link to="/continuity" className="text-sm text-accent">
          Create a new session
        </Link>
      </div>
    );
  }

  return <ContinuitySessionView />;
}

export function ContinuityPage(): React.ReactElement {
  return (
    <ContinuitySessionProvider>
      <ContinuityPageInner />
    </ContinuitySessionProvider>
  );
}

export default ContinuityPage;
