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
  if (match) {
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
  lastGeneratedAt = null,
  onPreviewGenerated,
  onKeepRefining,
  onRefinePrompt,
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
  const [isExporting, setIsExporting] = React.useState(false);
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

  const handleExportKeyframe = React.useCallback(async () => {
    if (!imageUrl || isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `keyframe-preview-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsExporting(false);
    }
  }, [imageUrl, isExporting]);

  if (!isVisible) return null;

  const displayAspectRatio = normalizedAspectRatio ?? '16:9';
  const status = loading ? 'Generating' : error ? 'Failed' : imageUrl ? 'Ready' : 'Idle';
  const statusDotClass = loading
    ? 'bg-neutral-300'
    : error
      ? 'bg-error-600'
      : imageUrl
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
            Visual Preview
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 text-xs text-geist-accents-6 bg-geist-accents-1 border border-geist-accents-2 rounded-full">
            Flux Schnell
          </span>
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

      <div className="flex items-center justify-between px-1 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={imageUrl ? 'Regenerate composition preview' : 'Generate composition preview'}
          >
            {imageUrl ? (loading ? 'Generating...' : 'Regenerate') : loading ? 'Generating...' : 'Generate'}
          </button>
          <button
            type="button"
            onClick={handleExportKeyframe}
            disabled={!imageUrl || isExporting}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Download keyframe"
          >
            {isExporting ? 'Downloading...' : 'Download'}
          </button>
          <button
            type="button"
            onClick={() => (imageUrl ? window.open(imageUrl, '_blank', 'noopener,noreferrer') : null)}
            disabled={!imageUrl}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist border border-geist-accents-2 bg-geist-background hover:bg-geist-accents-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open full size image"
          >
            Open
          </button>
        </div>
      </div>
      <div
        className="relative group w-full bg-geist-accents-1 rounded-lg overflow-hidden border border-geist-accents-2 shadow-sm"
        style={{ aspectRatio: displayAspectRatio.replace(':', ' / ') }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-geist-background/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-geist-foreground/30 border-t-geist-foreground rounded-full animate-spin" />
              <span className="text-xs text-geist-accents-5 font-medium">
                Rendering...
              </span>
            </div>
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-geist-error bg-geist-error/5 p-4 text-center">
            <Icon name="AlertTriangle" size={20} className="mb-2 opacity-80" />
            <span className="text-sm font-medium">Generation Failed</span>
            <span className="text-xs opacity-80 mt-1">Try regenerating</span>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Prompt Preview"
            className="w-full h-full object-cover transition-opacity duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-geist-accents-1 p-4 text-center">
            <Icon name="Image" size={22} className="text-geist-accents-5 mb-2" />
            <div className="text-sm font-medium text-geist-foreground">No composition preview yet</div>
            <div className="mt-1 text-xs text-geist-accents-6 max-w-xs">
              Generate to validate framing, placement, lighting, and overall mood.
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="mt-3 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-geist bg-geist-foreground text-geist-background hover:bg-geist-accents-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              aria-label="Generate composition preview"
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
          <li>Shot framing &amp; composition</li>
          <li>Subject placement</li>
          <li>Lighting direction</li>
          <li>Overall mood</li>
        </ul>
      </details>

      {imageUrl && (
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
