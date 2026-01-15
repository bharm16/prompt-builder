/**
 * Visual Preview Component
 *
 * Displays image previews generated from prompts using Flux models.
 * Provides loading states, error handling, and regeneration controls.
 */

import React from 'react';
import { Icon } from '@/components/icons/Icon';
import { useImagePreview } from '../hooks/useImagePreview';
import type { PreviewProvider } from '../api/previewApi';

interface VisualPreviewProps {
  prompt: string;
  aspectRatio?: string | null;
  isVisible: boolean;
  seedImageUrl?: string | null;
  generateRequestId?: number;
  lastGeneratedAt?: number | null;
  onPreviewGenerated?: ((payload: {
    prompt: string;
    generatedAt: number;
    imageUrl?: string | null;
    aspectRatio?: string | null;
  }) => void) | undefined;
  onLoadingChange?: ((loading: boolean) => void) | undefined;
  onKeepRefining?: (() => void) | undefined;
  onRefinePrompt?: (() => void) | undefined;
  showActions?: boolean;
  variant?: 'default' | 'rail';
}

const SUPPORTED_ASPECT_RATIOS = new Set([
  '1:1',
  '16:9',
  '21:9',
  '2:3',
  '3:2',
  '4:5',
  '5:4',
  '9:16',
  '9:21',
]);

const normalizeAspectRatio = (value?: string | null): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\s+/g, '').replace(/x/i, ':');

  if (SUPPORTED_ASPECT_RATIOS.has(normalized)) {
    return normalized;
  }

  if (
    normalized === '2.39:1' ||
    normalized === '2.4:1' ||
    normalized === '2.35:1' ||
    normalized === '2.37:1'
  ) {
    return '21:9';
  }

  if (normalized === '1.85:1' || normalized === '1.78:1' || normalized === '1.77:1') {
    return '16:9';
  }

  const match = normalized.match(/(\d+(?:\.\d+)?[:x]\d+(?:\.\d+)?)/i);
  if (match?.[1]) {
    const extracted = match[1].replace(/x/i, ':');
    if (SUPPORTED_ASPECT_RATIOS.has(extracted)) {
      return extracted;
    }
    if (
      extracted === '2.39:1' ||
      extracted === '2.4:1' ||
      extracted === '2.35:1' ||
      extracted === '2.37:1'
    ) {
      return '21:9';
    }
    if (extracted === '1.85:1' || extracted === '1.78:1' || extracted === '1.77:1') {
      return '16:9';
    }
  }

  return null;
};

const PREVIEW_PROVIDERS: { value: PreviewProvider; label: string }[] = [
  { value: 'replicate-flux-schnell', label: 'Schnell' },
  { value: 'replicate-flux-kontext-fast', label: 'Kontext Fast' },
];

export const VisualPreview: React.FC<VisualPreviewProps> = ({
  prompt,
  aspectRatio = null,
  isVisible,
  seedImageUrl = null,
  generateRequestId,
  onPreviewGenerated,
  onLoadingChange,
  showActions = true,
  variant = 'default',
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );
  const [provider, setProvider] =
    React.useState<PreviewProvider>('replicate-flux-schnell');
  const [useReferenceImage, setUseReferenceImage] = React.useState(true);
  const { imageUrl, imageUrls, loading, error, regenerate } = useImagePreview({
    prompt,
    isVisible,
    ...(normalizedAspectRatio ? { aspectRatio: normalizedAspectRatio } : {}),
    provider,
    seedImageUrl,
    useReferenceImage,
  });
  const hasReferenceImage = Boolean(imageUrl || seedImageUrl);
  const isKontext = provider === 'replicate-flux-kontext-fast';
  const shouldShowGrid = isKontext && imageUrls.length > 0;
  const displayUrl = shouldShowGrid ? null : imageUrl ?? seedImageUrl;
  const [lastRequestedPrompt, setLastRequestedPrompt] = React.useState<string>('');
  const lastReportedUrlRef = React.useRef<string | null>(null);
  const copyTimeoutRef = React.useRef<number | null>(null);
  const prevGenerateRequestIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!imageUrl) return;
    if (lastReportedUrlRef.current === imageUrl) return;
    lastReportedUrlRef.current = imageUrl;
    if (onPreviewGenerated) {
      onPreviewGenerated({
        prompt: lastRequestedPrompt || prompt,
        generatedAt: Date.now(),
        imageUrl,
        aspectRatio: normalizedAspectRatio ?? null,
      });
    }
  }, [imageUrl, lastRequestedPrompt, normalizedAspectRatio, onPreviewGenerated, prompt]);

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

  if (!isVisible) return null;

  // Per spec: the preview "monitor" frame is always 16:9
  const displayAspectRatio = '16 / 9';

  const containerPadding = variant === 'rail' ? 14 : 12;
  const emptyStateOffset = variant === 'rail' ? -12 : 0;
  const containerShadow =
    variant === 'rail'
      ? 'inset 0 0 0 1px rgba(255,255,255,0.03)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.6)';
  const controlPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.6)',
    color: '#E6E6E6',
    fontSize: 11,
    lineHeight: '14px',
    pointerEvents: 'auto',
  };
  const selectStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#F5F6F7',
    fontSize: 11,
    fontWeight: 600,
    outline: 'none',
  };
  const checkboxStyle: React.CSSProperties = {
    accentColor: '#F5F6F7',
  };

  return (
    <div
      className="w-full"
      style={{
        background: '#000',
        borderRadius: 12,
        padding: containerPadding,
        aspectRatio: displayAspectRatio,
        position: 'relative',
        boxShadow: containerShadow,
      }}
    >
      <div
        className="w-full h-full"
        style={{
          border: '1px solid #1F2329',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div className="absolute left-3 top-3 right-3 z-10 flex flex-wrap items-center gap-2">
          <label style={controlPillStyle}>
            <span style={{ color: '#9AA0A6' }}>Draft model</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as PreviewProvider)}
              style={selectStyle}
              aria-label="Draft model"
            >
              {PREVIEW_PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {isKontext && (
            <label style={controlPillStyle}>
              <input
                type="checkbox"
                checked={useReferenceImage}
                onChange={(event) => setUseReferenceImage(event.target.checked)}
                style={checkboxStyle}
                disabled={!hasReferenceImage}
                aria-label="Use current frame as reference"
              />
              <span style={{ color: hasReferenceImage ? '#E6E6E6' : '#9AA0A6' }}>
                Use current frame
              </span>
            </label>
          )}
        </div>
        {shouldShowGrid ? (
          <div
            className="w-full h-full"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 4,
              padding: 4,
              background: '#0B0C0E',
            }}
          >
            {imageUrls.map((url, index) => (
              <div
                key={`${index}-${url ?? 'empty'}`}
                className="w-full h-full"
                style={{
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                {url ? (
                  <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
            ))}
          </div>
        ) : displayUrl ? (
          <img src={displayUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-center">
            <div style={{ maxWidth: 220, margin: 'auto', transform: `translateY(${emptyStateOffset}px)` }}>
              <div className="text-[14px] text-[#9AA0A6]">
                Generate a preview to validate framing, lighting, and mood.
              </div>
              {showActions && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || !prompt}
                  className="mt-3 inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-white text-black text-[14px] font-semibold hover:bg-[#F2F2F2] active:translate-y-[1px] transition-[background-color,transform,opacity] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Generate preview"
                >
                  Generate
                </button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Icon name="AlertTriangle" size={20} className="mb-2 text-[#9AA0A6]" />
            <div className="text-[14px] text-[#9AA0A6]">Preview failed. Try again.</div>
            {showActions && (
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-white text-black text-[14px] font-semibold hover:bg-[#F2F2F2] active:translate-y-[1px] transition-[background-color,transform]"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
