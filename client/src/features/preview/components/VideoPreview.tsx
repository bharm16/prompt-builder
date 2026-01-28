/**
 * Video Preview Component
 *
 * Per Stage UX spec: this component is a **bare renderer**.
 * - When there's no output: render nothing (transparent)
 * - When there's output: render the video element only
 *
 * Stage (the parent) owns framing, empty states, and loading UI.
 */

import React from 'react';
import { useVideoPreview } from '../hooks/useVideoPreview';

interface VideoPreviewProps {
  prompt: string;
  aspectRatio?: string | null | undefined;
  model?: string | undefined;
  generationParams?: Record<string, unknown>;
  inputReference?: string;
  startImage?: string | null;
  isVisible: boolean;
  seedVideoUrl?: string | null;
  generateRequestId?: number;
  lastGeneratedAt?: number | null;
  videoRef?: React.Ref<HTMLVideoElement>;
  onPreviewGenerated?: ((payload: {
    prompt: string;
    generatedAt: number;
    videoUrl?: string | null;
    aspectRatio?: string | null;
    model?: string | null;
  }) => void) | undefined;
  onLoadingChange?: ((loading: boolean) => void) | undefined;
  onErrorChange?: ((error: string | null) => void) | undefined;
  onPreviewStateChange?: ((payload: {
    loading: boolean;
    error: string | null;
    videoUrl: string | null;
  }) => void) | undefined;
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
  startImage = null,
  isVisible,
  seedVideoUrl = null,
  generateRequestId,
  videoRef,
  onPreviewGenerated,
  onLoadingChange,
  onErrorChange,
  onPreviewStateChange,
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );

  const { videoUrl, loading, error, regenerate } = useVideoPreview({
    prompt,
    isVisible,
    aspectRatio: normalizedAspectRatio,
    ...(model ? { model } : {}),
    ...(inputReference?.trim() ? { inputReference: inputReference.trim() } : {}),
    ...(startImage?.trim() ? { startImage: startImage.trim() } : {}),
    ...(generationParams ? { generationParams } : {}),
  });
  const displayVideoUrl = videoUrl ?? seedVideoUrl;

  const [lastRequestedPrompt, setLastRequestedPrompt] = React.useState<string>('');
  const lastReportedUrlRef = React.useRef<string | null>(null);
  const prevGenerateRequestIdRef = React.useRef<number | null>(null);

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

  React.useEffect(() => {
    onErrorChange?.(error ? String(error) : null);
  }, [error, onErrorChange]);

  React.useEffect(() => {
    onPreviewStateChange?.({
      loading,
      error: error ? String(error) : null,
      videoUrl: displayVideoUrl ?? null,
    });
  }, [displayVideoUrl, error, loading, onPreviewStateChange]);

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

  if (!isVisible) return null;

  if (!displayVideoUrl) return null;

  return (
    <video
      ref={videoRef}
      src={displayVideoUrl}
      muted
      loop
      playsInline
      className="h-full w-full object-cover pointer-events-none"
    />
  );
};
