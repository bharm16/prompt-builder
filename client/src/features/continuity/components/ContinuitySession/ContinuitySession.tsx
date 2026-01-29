import React, { useEffect, useMemo, useState } from 'react';
import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { ContinuityShot, CreateShotInput, GenerationMode } from '../../types';
import { useContinuitySession } from '../../context/ContinuitySessionContext';
import { SessionTimeline } from './SessionTimeline';
import { ShotEditor } from '../ShotEditor';
import { StyleReferencePanel } from '../StyleReferencePanel';

export function ContinuitySessionView(): React.ReactElement {
  const {
    session,
    addShot,
    generateShot,
    createSceneProxy,
    updateStyleReference,
    updatePrimaryStyleReference,
    updateSessionSettings,
  } = useContinuitySession();
  const [mode, setMode] = useState<GenerationMode>(
    session?.defaultSettings.generationMode ?? 'continuity'
  );
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  useEffect(() => {
    if (session?.defaultSettings.generationMode) {
      setMode(session.defaultSettings.generationMode);
    }
  }, [session?.defaultSettings.generationMode]);

  useEffect(() => {
    if (!session) return;
    if (selectedShotId && session.shots.some((shot) => shot.id === selectedShotId)) {
      return;
    }
    const lastShot = session.shots[session.shots.length - 1];
    setSelectedShotId(lastShot?.id ?? null);
  }, [session?.shots, selectedShotId]);

  const selectedShot = useMemo<ContinuityShot | null>(() => {
    if (!session || !selectedShotId) return null;
    return session.shots.find((shot) => shot.id === selectedShotId) ?? null;
  }, [session, selectedShotId]);

  if (!session) {
    return <div className="p-6">No session loaded.</div>;
  }

  const onAddShot = async (input: CreateShotInput) => {
    setLocalError(null);
    try {
      const shot = await addShot(input);
      setSelectedShotId(shot.id);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };

  const onGenerate = async (shotId: string) => {
    setLocalError(null);
    try {
      await generateShot(shotId);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  };

  const onView = async (assetId: string) => {
    const authHeaders = await buildFirebaseAuthHeaders();
    const response = await fetch(
      `${API_CONFIG.baseURL}/preview/video/view?assetId=${encodeURIComponent(assetId)}`,
      {
        headers: { ...authHeaders },
      }
    );
    const payload = await response.json();
    if (response.ok && payload?.data?.viewUrl) {
      window.open(payload.data.viewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const onBuildSceneProxy = async () => {
    if (!session.shots.length) return;
    const sourceShotId = selectedShot?.id ?? session.shots[0]?.id;
    if (!sourceShotId) return;
    await createSceneProxy({ sourceShotId });
  };

  const onModeChange = async (nextMode: GenerationMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setIsUpdatingMode(true);
    try {
      await updateSessionSettings({ generationMode: nextMode });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const onToggleSceneProxy = async (enabled: boolean) => {
    setIsUpdatingMode(true);
    try {
      await updateSessionSettings({ useSceneProxy: enabled });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingMode(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{session.name}</h1>
          {session.description && (
            <p className="text-sm text-muted">{session.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Mode:</span>
          <button
            type="button"
            className={`px-3 py-1 rounded ${
              mode === 'continuity' ? 'bg-foreground text-white' : 'bg-surface-2 text-muted'
            }`}
            onClick={() => void onModeChange('continuity')}
          >
            Continuity
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded ${
              mode === 'standard' ? 'bg-foreground text-white' : 'bg-surface-2 text-muted'
            }`}
            onClick={() => void onModeChange('standard')}
          >
            Standard
          </button>
          {isUpdatingMode && <span className="text-xs text-muted">Saving…</span>}
        </div>
      </div>

      {localError && (
        <div className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">
          {localError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Shot Timeline</h2>
              <span className="text-xs text-muted">{session.shots.length} shots</span>
            </div>
            <SessionTimeline
              shots={session.shots}
              selectedShotId={selectedShotId}
              onSelectShot={setSelectedShotId}
              onGenerateShot={onGenerate}
              onViewAsset={onView}
            />
          </div>

          <ShotEditor session={session} generationMode={mode} onAddShot={onAddShot} />
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <StyleReferencePanel
              session={session}
              selectedShot={selectedShot}
              onUpdateShotStyleReference={updateStyleReference}
              onUpdatePrimaryReference={updatePrimaryStyleReference}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Scene Proxy (Phase 2)</h2>
              <span className="text-xs text-muted">Optional</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={Boolean(session.defaultSettings.useSceneProxy)}
                onChange={(event) => void onToggleSceneProxy(event.target.checked)}
              />
              Use scene proxy when available
            </label>
            {session.sceneProxy?.status === 'ready' ? (
              <div className="space-y-2">
                <img
                  src={session.sceneProxy.referenceFrameUrl}
                  alt="Scene proxy reference"
                  className="rounded w-full object-cover"
                />
                <div className="text-xs text-muted">Proxy type: {session.sceneProxy.proxyType}</div>
              </div>
            ) : (
              <div className="text-sm text-muted">
                {session.sceneProxy?.status === 'failed'
                  ? session.sceneProxy.error || 'Scene proxy failed. Try a different source shot.'
                  : 'No scene proxy created yet.'}
              </div>
            )}
            <button
              type="button"
              className={`px-3 py-1 rounded text-sm ${
                session.shots.length > 0
                  ? 'bg-foreground text-white'
                  : 'bg-surface-3 text-muted cursor-not-allowed'
              }`}
              onClick={onBuildSceneProxy}
              disabled={session.shots.length === 0}
            >
              Build Scene Proxy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContinuitySessionView;
