import React, { useState, useCallback } from 'react';
import { Wand2, Video, Check, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';
import { TriggerChip } from '../assets/components/TriggerChip';

const STAGES = {
  WRITE_PROMPT: 'write_prompt',
  APPROVE_KEYFRAME: 'approve_keyframe',
  GENERATE_VIDEO: 'generate_video',
  COMPLETE: 'complete',
} as const;

type Stage = (typeof STAGES)[keyof typeof STAGES];

export function ConsistentGenerationPanel({
  onComplete,
}: {
  onComplete?: (result: any) => void;
}): React.ReactElement {
  const [stage, setStage] = useState<Stage>(STAGES.WRITE_PROMPT);
  const [prompt, setPrompt] = useState('');
  const [resolvedData, setResolvedData] = useState<any>(null);
  const [keyframeOptions, setKeyframeOptions] = useState<any[]>([]);
  const [selectedKeyframe, setSelectedKeyframe] = useState<any | null>(null);
  const [videoResult, setVideoResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolvePrompt = useCallback(async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/assets/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve prompt');
      }

      const data = await response.json();
      setResolvedData(data);

      if (data.requiresKeyframe && data.characters.length > 0) {
        await generateKeyframes(data);
      } else {
        setStage(STAGES.GENERATE_VIDEO);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve prompt');
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  const generateKeyframes = useCallback(async (resolved: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const primaryCharacter = resolved.characters[0];
      const response = await fetch('/api/generate/consistent/keyframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          characterId: primaryCharacter.id,
          prompt: resolved.expandedText,
          count: 3,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate keyframes');
      }

      const result = await response.json();
      setKeyframeOptions(Array.isArray(result) ? result : [result]);
      setStage(STAGES.APPROVE_KEYFRAME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keyframes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApproveKeyframe = useCallback((keyframe: any) => {
    setSelectedKeyframe(keyframe);
    setStage(STAGES.GENERATE_VIDEO);
  }, []);

  const handleGenerateVideo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = selectedKeyframe
        ? '/api/generate/consistent/from-keyframe'
        : '/api/generate/consistent/video';

      const body = selectedKeyframe
        ? {
            keyframeUrl: selectedKeyframe.imageUrl,
            prompt: resolvedData?.expandedText || prompt,
            model: 'luma',
            duration: 5,
          }
        : {
            prompt: resolvedData?.expandedText || prompt,
            videoModel: 'luma',
            duration: 5,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to generate video');
      }

      const result = await response.json();
      setVideoResult(result);
      setStage(STAGES.COMPLETE);
      onComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setIsLoading(false);
    }
  }, [selectedKeyframe, resolvedData, prompt, onComplete]);

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <StageIndicator
          stages={[STAGES.WRITE_PROMPT, STAGES.APPROVE_KEYFRAME, STAGES.GENERATE_VIDEO, STAGES.COMPLETE]}
          currentStage={stage}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-border bg-red-50 px-4 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {stage === STAGES.WRITE_PROMPT && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Prompt</label>
              <p className="mb-2 text-xs text-muted">
                Use <code className="rounded bg-surface-2 px-1 py-0.5 text-violet-600">@triggers</code> to reference assets
              </p>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="@Alice walks through @TokyoAlley at night in @CyberNoir style..."
                className="h-40 w-full resize-none rounded-lg border border-border bg-surface-1 p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <button
              type="button"
              onClick={handleResolvePrompt}
              disabled={!prompt.trim() || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:bg-surface-2 disabled:text-muted"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        )}

        {stage === STAGES.APPROVE_KEYFRAME && (
          <div className="space-y-4">
            {resolvedData?.characters?.length > 0 && (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted">Generating with:</span>
                {resolvedData.characters.map((char: any) => (
                  <TriggerChip key={char.id} asset={char} size="small" />
                ))}
              </div>
            )}

            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">Choose a keyframe</h3>
              <p className="text-sm text-muted">Select the image that best captures your vision.</p>
            </div>

            <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {keyframeOptions.map((keyframe, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleApproveKeyframe(keyframe)}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-surface-2 transition-all hover:ring-2 hover:ring-violet-500"
                >
                  <img
                    src={keyframe.imageUrl}
                    alt={`Option ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white">
                      <Check className="h-4 w-4" />
                      Select
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                    Face strength: {Math.round((keyframe.faceStrength || 0) * 100)}%
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => generateKeyframes(resolvedData)}
              disabled={isLoading}
              className="mx-auto flex items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Regenerate options
            </button>
          </div>
        )}

        {stage === STAGES.GENERATE_VIDEO && (
          <div className="mx-auto max-w-2xl space-y-6">
            {selectedKeyframe && (
              <div className="aspect-video overflow-hidden rounded-xl bg-surface-2">
                <img
                  src={selectedKeyframe.imageUrl}
                  alt="Selected keyframe"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="text-center">
              <p className="mb-4 text-sm text-muted">
                {selectedKeyframe ? 'Ready to animate this keyframe' : 'Ready to generate video'}
              </p>
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={isLoading}
                className="mx-auto flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:bg-surface-2 disabled:text-muted"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4" />
                    Generate Video
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {stage === STAGES.COMPLETE && videoResult && (
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <div className="aspect-video overflow-hidden rounded-xl bg-surface-2">
              <video
                src={videoResult.video?.videoUrl || videoResult.videoUrl}
                controls
                className="h-full w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-emerald-600">
              <Check className="h-5 w-5" />
              <span>Video generated successfully</span>
            </div>

            {videoResult.character && (
              <p className="text-sm text-muted">
                Generated with consistent appearance for {videoResult.character.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StageIndicator({
  stages,
  currentStage,
}: {
  stages: Stage[];
  currentStage: Stage;
}) {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => (
        <React.Fragment key={stage}>
          <div
            className={`h-2 w-2 rounded-full ${
              index <= currentIndex ? 'bg-violet-500' : 'bg-surface-3'
            }`}
          />
          {index < stages.length - 1 && (
            <ChevronRight
              className={`h-3 w-3 ${
                index < currentIndex ? 'text-violet-500' : 'text-muted'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ConsistentGenerationPanel;
