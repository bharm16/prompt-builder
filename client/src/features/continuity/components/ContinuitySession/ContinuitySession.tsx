import React, { useState } from 'react';
import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import { useContinuitySession } from '../../context/ContinuitySessionContext';

export function ContinuitySessionView(): React.ReactElement {
  const { session, addShot, generateShot, createSceneProxy } = useContinuitySession();
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'continuity' | 'standard'>(session?.defaultSettings.generationMode ?? 'continuity');

  if (!session) {
    return <div className="p-6">No session loaded.</div>;
  }

  const onAddShot = async () => {
    if (!prompt.trim()) return;
    await addShot({ prompt, generationMode: mode });
    setPrompt('');
  };

  const onGenerate = async (shotId: string) => {
    await generateShot(shotId);
  };

  const onView = async (assetId: string) => {
    const authHeaders = await buildFirebaseAuthHeaders();
    const response = await fetch(`${API_CONFIG.baseURL}/preview/video/view?assetId=${encodeURIComponent(assetId)}`, {
      headers: { ...authHeaders },
    });
    const payload = await response.json();
    if (response.ok && payload?.data?.viewUrl) {
      window.open(payload.data.viewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          {session.description && <p className="text-sm text-slate-500">{session.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Mode:</span>
          <button
            className={`px-3 py-1 rounded ${mode === 'continuity' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('continuity')}
          >
            Continuity
          </button>
          <button
            className={`px-3 py-1 rounded ${mode === 'standard' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
            onClick={() => setMode('standard')}
          >
            Standard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-medium">Style Reference</h2>
          <img
            src={session.primaryStyleReference.frameUrl}
            alt="Style reference"
            className="rounded w-full object-cover"
          />
          {session.primaryStyleReference.analysisMetadata && (
            <div className="text-sm text-slate-600">
              <div>Lighting: {session.primaryStyleReference.analysisMetadata.lightingDescription}</div>
              <div>Mood: {session.primaryStyleReference.analysisMetadata.moodDescription}</div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-medium">Scene Proxy (Phase 2)</h2>
          {session.sceneProxy?.status === 'ready' ? (
            <div className="space-y-2">
              <img
                src={session.sceneProxy.referenceFrameUrl}
                alt="Scene proxy reference"
                className="rounded w-full object-cover"
              />
              <div className="text-xs text-slate-500">Proxy type: {session.sceneProxy.proxyType}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">
              {session.sceneProxy?.status === 'failed'
                ? 'Scene proxy failed. Try a different source shot.'
                : 'No scene proxy created yet.'}
            </div>
          )}
          <button
            className={`px-3 py-1 rounded text-sm ${
              session.shots.length > 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
            onClick={() =>
              session.shots.length > 0 &&
              createSceneProxy({ sourceShotId: session.shots[0]?.id })
            }
            disabled={session.shots.length === 0}
          >
            Build Scene Proxy
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Add Shot</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full border rounded p-2 min-h-[80px]"
          placeholder="Describe the next shot"
        />
        <button className="px-4 py-2 bg-slate-900 text-white rounded" onClick={onAddShot}>
          Add Shot
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Shots</h2>
        <div className="space-y-3">
          {session.shots.map((shot) => (
            <div key={shot.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">Shot {shot.sequenceIndex + 1}</div>
                <div className="text-sm text-slate-600">{shot.userPrompt}</div>
                <div className="text-xs text-slate-500">Status: {shot.status}</div>
              </div>
              <div className="flex items-center gap-2">
                {shot.videoAssetId && (
                  <button
                    className="text-xs text-slate-500"
                    onClick={() => onView(shot.videoAssetId!)}
                  >
                    View
                  </button>
                )}
                <button
                  className="px-3 py-1 text-sm rounded bg-slate-900 text-white"
                  onClick={() => onGenerate(shot.id)}
                >
                  Generate
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ContinuitySessionView;
