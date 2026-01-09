/**
 * Video Preview Component
 *
 * Cinematic "stage" for motion previews generated from prompts.
 */

import React from 'react';
import { Icon } from '@/components/icons/Icon';
import { useVideoPreview } from '../hooks/useVideoPreview';
import { useRemoteDownload } from '../hooks/useRemoteDownload';
import { logger } from '@/services/LoggingService';
import './VideoPreview.css';

interface VideoPreviewProps {
  prompt: string;
  aspectRatio?: string | null;
  model?: string;
  generationParams?: Record<string, unknown>;
  inputReference?: string;
  isVisible: boolean;
  seedVideoUrl?: string | null;
  generateRequestId?: number;
  lastGeneratedAt?: number | null;
  onPreviewGenerated?: ((payload: {
    prompt: string;
    generatedAt: number;
    videoUrl?: string | null;
    aspectRatio?: string | null;
    model?: string | null;
  }) => void) | undefined;
  onLoadingChange?: ((loading: boolean) => void) | undefined;
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
  generationParams,
  inputReference,
  isVisible,
  seedVideoUrl = null,
  generateRequestId,
  lastGeneratedAt = null,
  onPreviewGenerated,
  onLoadingChange,
  onKeepRefining,
  onRefinePrompt,
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );
  const log = React.useMemo(() => logger.child('VideoPreview'), []);

  const hasPrompt = prompt.trim().length > 0;

  const { videoUrl, loading, error, regenerate } = useVideoPreview({
    prompt,
    isVisible,
    aspectRatio: normalizedAspectRatio,
    ...(model ? { model } : {}),
    ...(inputReference?.trim() ? { inputReference: inputReference.trim() } : {}),
    ...(generationParams ? { generationParams } : {}),
  });
  const displayVideoUrl = videoUrl ?? seedVideoUrl;
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
        videoUrl,
        aspectRatio: normalizedAspectRatio ?? null,
        model: model ?? null,
      });
    }
  }, [videoUrl, lastRequestedPrompt, model, normalizedAspectRatio, onPreviewGenerated, prompt]);

  React.useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

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
      url: displayVideoUrl,
      fileName: `motion-preview-${Date.now()}.mp4`,
    });
  }, [download, displayVideoUrl]);

  if (!isVisible) return null;

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

  const stageState: 'loading' | 'failed' | 'ready' | 'idle' = loading
    ? 'loading'
    : displayError
      ? 'failed'
      : displayVideoUrl
        ? 'ready'
        : 'idle';

  const [etaSeconds, setEtaSeconds] = React.useState<number | null>(null);
  const loadingStartRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!loading) {
      loadingStartRef.current = null;
      setEtaSeconds(null);
      return;
    }

    if (!loadingStartRef.current) {
      loadingStartRef.current = Date.now();
    }

    const expectedSeconds = 22;
    const interval = window.setInterval(() => {
      const start = loadingStartRef.current;
      if (!start) return;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setEtaSeconds(Math.max(3, expectedSeconds - elapsed));
    }, 250);

    return () => window.clearInterval(interval);
  }, [loading]);

  return (
    <div className="pc-video-preview">
      <div
        className="pc-video-stage"
        data-state={stageState}
        style={{ aspectRatio: normalizedAspectRatio.replace(':', ' / ') }}
        aria-busy={loading ? 'true' : 'false'}
        aria-live="polite"
      >
        <div className="pc-video-stage__glow" aria-hidden="true" />
        <div className="pc-video-stage__chrome" aria-hidden="true" />
        <div className="pc-video-stage__grain" aria-hidden="true" />
        <div className="pc-video-stage__vignette" aria-hidden="true" />
        {loading && <div className="pc-video-stage__scanlines" aria-hidden="true" />}

        <div className="pc-video-stage__top">
          <div className="pc-video-stage__status">
            <span className={`pc-video-stage__dot pc-video-stage__dot--${stageState}`} aria-hidden="true" />
            <span className="pc-video-stage__status-text">
              {stageState === 'loading'
                ? 'Generating'
                : stageState === 'failed'
                  ? 'Failed'
                  : stageState === 'ready'
                    ? 'Ready'
                    : 'Idle'}
              {lastGeneratedAt ? ` · ${formatRelativeUpdate(lastGeneratedAt)}` : ''}
            </span>
          </div>

          {displayVideoUrl && (
            <div className="pc-video-stage__tools" role="group" aria-label="Preview actions">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !hasPrompt}
                className="pc-video-stage__tool"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!displayVideoUrl || isDownloading}
                className="pc-video-stage__tool"
              >
                {isDownloading ? 'Downloading…' : 'Download'}
              </button>
              <button
                type="button"
                onClick={() => window.open(displayVideoUrl, '_blank', 'noopener,noreferrer')}
                className="pc-video-stage__tool"
              >
                Open
              </button>
            </div>
          )}
        </div>

        {stageState === 'failed' ? (
          <div className="pc-video-stage__center">
            <Icon name="AlertTriangle" size={22} className="pc-video-stage__icon" />
            <div className="pc-video-stage__title">Generation failed</div>
            <div className="pc-video-stage__subtitle">{displayError}</div>
          </div>
        ) : stageState === 'ready' && displayVideoUrl ? (
          <video
            src={displayVideoUrl}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="pc-video-stage__video"
            onError={(e) => {
              log.warn('Video playback error', {
                operation: 'video.onError',
                eventType: e.type,
              });
              const target = e.target as HTMLVideoElement;
              if (target?.error) {
                log.warn('Media error details', {
                  operation: 'video.onError',
                  mediaErrorCode: target.error.code,
                  mediaErrorMessage: (target.error as unknown as { message?: string }).message ?? null,
                });
              }
            }}
          />
        ) : (
          <div className="pc-video-stage__center">
            <Icon name="Play" size={22} className="pc-video-stage__icon" />
            <div className="pc-video-stage__title">
              {stageState === 'loading' ? 'Generating preview…' : 'Stage is set'}
            </div>
            <div className="pc-video-stage__subtitle">
              {stageState === 'loading'
                ? 'Validating motion, pacing, and camera behavior'
                : 'Press Generate Preview to watch motion, pacing, and camera come alive.'}
            </div>
          </div>
        )}

        {stageState === 'loading' && (
          <div className="pc-video-stage__eta" aria-label="Estimated time remaining">
            {etaSeconds ? `Est. ${etaSeconds}s` : 'Working…'}
          </div>
        )}
      </div>

      {displayVideoUrl && (
        <div className="pc-video-preview__next">
          <button type="button" onClick={onKeepRefining} className="pc-video-preview__link">
            ✓ Looks right → Keep refining
          </button>
          <button type="button" onClick={onRefinePrompt} className="pc-video-preview__link">
            ✕ Something’s off → Refine prompt
          </button>
        </div>
      )}
    </div>
  );
};
