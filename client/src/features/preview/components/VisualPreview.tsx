/**
 * Visual Preview Component
 *
 * Displays image previews generated from prompts using Flux Schnell.
 * Provides loading states, error handling, and regeneration controls.
 */

import React from 'react';
import { Icon } from '@/components/icons/Icon';
import { useImagePreview } from '../hooks/useImagePreview';

interface VisualPreviewProps {
  prompt: string;
  aspectRatio?: string | null;
  isVisible: boolean;
  generateRequestId?: number;
  lastGeneratedAt?: number | null;
  onPreviewGenerated?: ((payload: { prompt: string; generatedAt: number }) => void) | undefined;
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

export const VisualPreview: React.FC<VisualPreviewProps> = ({
  prompt,
  aspectRatio = null,
  isVisible,
  generateRequestId,
  onPreviewGenerated,
  showActions = true,
  variant = 'default',
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );
  const { imageUrl, loading, error, regenerate } = useImagePreview({
    prompt,
    isVisible,
    ...(normalizedAspectRatio ? { aspectRatio: normalizedAspectRatio } : {}),
  });
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
      });
    }
  }, [imageUrl, lastRequestedPrompt, onPreviewGenerated, prompt]);

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
  const containerShadow =
    variant === 'rail'
      ? 'inset 0 0 0 1px rgba(255,255,255,0.03)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.6)';

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
        {imageUrl ? (
          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-6 text-center">
            <div style={{ maxWidth: 220, margin: 'auto' }}>
              <div className="text-[14px] text-[#9AA0A6]">
                Generate a preview to validate framing, lighting, and mood.
              </div>
              {showActions && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading || !prompt}
                  className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-white text-black text-[14px] font-semibold hover:bg-[#F2F2F2] active:translate-y-[1px] transition-[background-color,transform,opacity] disabled:opacity-50 disabled:cursor-not-allowed"
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
