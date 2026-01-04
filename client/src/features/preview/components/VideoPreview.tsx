/**
 * Video Preview Component
 *
 * Displays video previews generated from prompts using supported video models.
 * Provides loading states, error handling, and regeneration controls.
 */

import React from 'react';
import { Icon } from '@/components/icons/Icon';
import { useVideoPreview } from '../hooks/useVideoPreview';
import { useRemoteDownload } from '../hooks/useRemoteDownload';

const VIDEO_PREVIEW_MODEL_IDS = ['PRO', 'SORA_2', 'LUMA_RAY3', 'KLING_V2_1', 'VEO_3'] as const;

type VideoPreviewModelId = typeof VIDEO_PREVIEW_MODEL_IDS[number];

const VIDEO_PREVIEW_MODEL_LABELS: Record<VideoPreviewModelId, string> = {
  PRO: 'Wan 2.2',
  SORA_2: 'Sora 2',
  LUMA_RAY3: 'Luma',
  KLING_V2_1: 'Kling v2.1',
  VEO_3: 'Veo 3',
};

const isVideoPreviewModel = (value?: string): value is VideoPreviewModelId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(VIDEO_PREVIEW_MODEL_LABELS, value);

const VIDEO_PREVIEW_MODEL_ALIASES: Record<string, VideoPreviewModelId> = {
  'wan-video/wan-2.2-t2v-fast': 'PRO',
  'openai/sora-2': 'SORA_2',
  'sora-2': 'SORA_2',
  'sora-2-pro': 'SORA_2',
  'luma-ray3': 'LUMA_RAY3',
  luma: 'LUMA_RAY3',
  'kwaivgi/kling-v2.1': 'KLING_V2_1',
  'kling-v2-1-master': 'KLING_V2_1',
  'google/veo-3': 'VEO_3',
  'veo-3.1-generate-preview': 'VEO_3',
};

const resolveVideoPreviewModel = (value?: string): VideoPreviewModelId => {
  if (isVideoPreviewModel(value)) {
    return value;
  }
  if (value && Object.prototype.hasOwnProperty.call(VIDEO_PREVIEW_MODEL_ALIASES, value)) {
    return VIDEO_PREVIEW_MODEL_ALIASES[value];
  }
  return 'PRO';
};

interface VideoPreviewProps {
  prompt: string;
  aspectRatio?: string | null;
  model?: string;
  isVisible: boolean;
  generateRequestId?: number;
  lastGeneratedAt?: number | null;
  onPreviewGenerated?: ((payload: { prompt: string; generatedAt: number }) => void) | undefined;
  onKeepRefining?: (() => void) | undefined;
  onRefinePrompt?: (() => void) | undefined;
}

const normalizeAspectRatio = (value?: string | null): string => {
  if (!value) return '16:9';
  const cleaned = value.trim().replace(/x/i, ':');
  if (['16:9', '9:16', '21:9', '1:1'].includes(cleaned)) return cleaned;
  return '16:9';
};

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  prompt,
  aspectRatio = null,
  model,
  isVisible,
  generateRequestId,
  lastGeneratedAt = null,
  onPreviewGenerated,
  onKeepRefining,
  onRefinePrompt,
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );

  const [selectedModel, setSelectedModel] = React.useState<VideoPreviewModelId>(() =>
    resolveVideoPreviewModel(model)
  );
  const [inputReference, setInputReference] = React.useState('');

  React.useEffect(() => {
    if (!model) {
      return;
    }
    const resolvedModel = resolveVideoPreviewModel(model);
    if (resolvedModel !== selectedModel) {
      setSelectedModel(resolvedModel);
    }
  }, [model, selectedModel]);

  const allowsInputReference = selectedModel === 'SORA_2';
  const trimmedInputReference = inputReference.trim();
  const hasPrompt = prompt.trim().length > 0;

  const { videoUrl, loading, error, regenerate } = useVideoPreview({
    prompt,
    isVisible,
    aspectRatio: normalizedAspectRatio,
    model: selectedModel,
    inputReference: allowsInputReference ? trimmedInputReference || undefined : undefined,
  });
  const displayError = error;

  const [lastRequestedPrompt, setLastRequestedPrompt] = React.useState<string>('');
  const lastReportedUrlRef = React.useRef<string | null>(null);
  const prevGenerateRequestIdRef = React.useRef<number | null>(null);
  const { isDownloading, download } = useRemoteDownload();

  React.useEffect(() => {
    if (!videoUrl) return;
    if (lastReportedUrlRef.current === videoUrl) return;
    lastReportedUrlRef.current = videoUrl;
    if (onPreviewGenerated) {
      onPreviewGenerated({
        prompt: lastRequestedPrompt || prompt,
        generatedAt: Date.now(),
      });
    }
  }, [videoUrl, lastRequestedPrompt, onPreviewGenerated, prompt]);

  const handleGenerate = React.useCallback(() => {
    setLastRequestedPrompt(prompt);
    regenerate();
  }, [prompt, regenerate]);

  React.useEffect(() => {
    if (!isVisible) return;
    if (generateRequestId == null) return;
    if (prevGenerateRequestIdRef.current === generateRequestId) return;
    prevGenerateRequestIdRef.current = generateRequestId;
    if (generateRequestId > 0) {
      handleGenerate();
    }
  }, [generateRequestId, handleGenerate, isVisible]);

  const handleDownload = React.useCallback(async () => {
    await download({
      url: videoUrl,
      fileName: `motion-preview-${Date.now()}.mp4`,
    });
  }, [download, videoUrl]);

  if (!isVisible) return null;

  const status = loading ? 'Generating' : displayError ? 'Failed' : videoUrl ? 'Ready' : 'Idle';
  const statusDotClass = loading
    ? 'bg-neutral-300'
    : displayError
      ? 'bg-error-600'
      : videoUrl
        ? 'bg-success-600'
        : 'bg-neutral-300';

  const formatRelativeUpdate = (timestamp: number): string => {
    const diffMs = Math.max(0, Date.now() - timestamp);
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between px-1 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">
            Video Preview
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-2 text-xs text-geist-accents-5">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
            <span>{status}</span>
          </span>
          {lastGeneratedAt ? (
            <span className="text-xs text-geist-accents-6">Last {formatRelativeUpdate(lastGeneratedAt)}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1" role="group" aria-label="Video preview model">
        <span className="text-xs font-medium text-geist-accents-6">Model</span>
        {VIDEO_PREVIEW_MODEL_IDS.map((modelId) => {
          const isSelected = modelId === selectedModel;
          return (
            <button
              key={modelId}
              type="button"
              onClick={() => setSelectedModel(modelId)}
              aria-pressed={isSelected}
              className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-geist border transition-colors ${
                isSelected
                  ? 'bg-geist-foreground text-geist-background border-geist-foreground'
                  : 'bg-geist-background text-geist-accents-6 border-geist-accents-2 hover:bg-geist-accents-1'
              }`}
            >
              {VIDEO_PREVIEW_MODEL_LABELS[modelId]}
            </button>
          );
        })}
      </div>

      {allowsInputReference && (
        <div className="flex flex-col gap-1.5 px-1">
          <label
            htmlFor="video-preview-input-reference"
            className="text-xs font-medium text-geist-accents-6"
          >
            Reference image URL (optional)
          </label>
          <input
            id="video-preview-input-reference"
            type="url"
            value={inputReference}
            onChange={(event) => setInputReference(event.target.value)}
            placeholder="https://example.com/reference-image.jpg"
            className="w-full rounded-geist border border-geist-accents-2 bg-geist-background px-3 py-2 text-xs text-geist-foreground placeholder:text-geist-accents-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4"
          />
        </div>
      )}

      <div className="flex items-center justify-between px-1 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !hasPrompt}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={videoUrl ? 'Regenerate motion preview' : 'Generate motion preview'}
          >
            {videoUrl ? (loading ? 'Generating...' : 'Regenerate') : loading ? 'Generating...' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!videoUrl || isDownloading}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Download motion preview"
          >
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
          <button
            type="button"
            onClick={() => (videoUrl ? window.open(videoUrl, '_blank', 'noopener,noreferrer') : null)}
            disabled={!videoUrl}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open motion preview"
          >
            Open
          </button>
        </div>
      </div>
      
      <div
        className="relative group w-full bg-geist-accents-1 rounded-lg overflow-hidden border border-geist-accents-2 shadow-sm"
        style={{ aspectRatio: normalizedAspectRatio.replace(':', ' / ') }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-geist-background/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-geist-foreground/30 border-t-geist-foreground rounded-full animate-spin" />
              <span className="text-xs text-geist-accents-5 font-medium">
                Generating video...
              </span>
            </div>
          </div>
        )}
        
        {displayError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-geist-error bg-geist-error/5 p-4 text-center">
            <Icon name="AlertTriangle" size={20} className="mb-2 opacity-80" />
            <span className="text-sm font-medium">Generation Failed</span>
            <span className="text-xs opacity-80 mt-1">{displayError}</span>
          </div>
        ) : videoUrl ? (
          <>
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Video playback error:', e);
                const target = e.target as HTMLVideoElement;
                if (target.error) {
                  console.error('Media Error Details:', target.error);
                }
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-geist-accents-1 p-4 text-center">
            <Icon name="Play" size={22} className="text-geist-accents-5 mb-2" />
            <div className="text-sm font-medium text-geist-foreground">No motion preview yet</div>
            <div className="mt-1 text-xs text-geist-accents-6 max-w-xs">
              Generate to validate movement, pacing, and camera behavior.
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !hasPrompt}
              className="mt-3 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist bg-geist-foreground text-geist-background hover:bg-geist-accents-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              aria-label="Generate motion preview"
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        )}
      </div>

      <details className="px-1 text-xs text-geist-accents-6">
        <summary className="cursor-pointer select-none text-geist-accents-5 hover:text-geist-foreground">
          What this checks
        </summary>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Motion coherence</li>
          <li>Camera movement</li>
          <li>Subject consistency</li>
          <li>Pacing &amp; timing</li>
        </ul>
      </details>
      
      {videoUrl && (
        <div className="px-1">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onKeepRefining}
              className="text-xs text-geist-foreground hover:underline text-left"
            >
              ✓ Looks right → Keep refining
            </button>
            <button
              type="button"
              onClick={onRefinePrompt}
              className="text-xs text-geist-foreground hover:underline text-left"
            >
              ✕ Something’s off → Refine prompt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
