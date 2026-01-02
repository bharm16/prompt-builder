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

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">
            Visual Preview
          </h3>
          <span className="text-xs text-geist-accents-5">Flux Schnell</span>
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
          <>
            <img
              src={imageUrl}
              alt="Prompt Preview"
              className="w-full h-full object-cover transition-opacity duration-500"
            />
            {/* Overlay actions */}
            <div className="absolute bottom-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-md border border-white/10 hover:bg-black/90 disabled:opacity-60"
                onClick={handleGenerate}
                aria-label="Regenerate composition preview"
                disabled={loading || !prompt}
              >
                {loading ? 'Generating...' : 'Regenerate'}
              </button>
              <button
                className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-md border border-white/10 hover:bg-black/90 disabled:opacity-60"
                onClick={handleExportKeyframe}
                aria-label="Export keyframe"
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export Keyframe'}
              </button>
              <button
                className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-md border border-white/10 hover:bg-black/90"
                onClick={() => window.open(imageUrl, '_blank')}
                aria-label="Open full size image"
              >
                Full Size
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-geist-accents-1 p-4 text-center">
            <div className="max-w-xs text-xs text-geist-accents-5 leading-relaxed">
              <div className="font-medium text-geist-foreground mb-2">Use preview to sanity-check:</div>
              <div>• Shot framing &amp; composition</div>
              <div>• Subject placement</div>
              <div>• Lighting direction</div>
              <div className="mb-3">• Overall mood</div>
              <div className="text-geist-accents-6">
                Generate a preview whenever you want to validate changes.
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="mt-4 inline-flex items-center justify-center gap-1.5 bg-geist-foreground text-geist-background rounded-geist font-medium hover:bg-geist-accents-8 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              style={{
                padding: 'clamp(0.375rem, 1.2vw, 0.5rem) clamp(0.75rem, 2.5vw, 1rem)',
                fontSize: 'clamp(0.625rem, 1.1vw, 0.75rem)',
                gap: 'clamp(0.25rem, 0.6vw, 0.5rem)',
                maxWidth: 'min(90%, 260px)',
                width: 'auto',
              }}
              aria-label="Generate Composition Preview"
            >
              {loading ? (
                <div
                  className="border-2 border-geist-background/30 border-t-geist-background rounded-full animate-spin flex-shrink-0"
                  style={{
                    width: 'clamp(0.75rem, 1.2vw, 1rem)',
                    height: 'clamp(0.75rem, 1.2vw, 1rem)',
                  }}
                />
              ) : (
                <Icon
                  name="Image"
                  size={14}
                  style={{
                    width: 'clamp(0.875rem, 1.2vw, 1rem)',
                    height: 'clamp(0.875rem, 1.2vw, 1rem)',
                    flexShrink: 0,
                  }}
                />
              )}
              <span className="whitespace-nowrap">
                {loading ? 'Generating...' : 'Generate Composition Preview'}
              </span>
            </button>
            <div className="mt-2 text-xs text-geist-accents-5">
              Low-fidelity · Validates framing, lighting, and mood
            </div>
          </div>
        )}
      </div>

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
