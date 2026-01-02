/**
 * Video Preview Component
 *
 * Displays video previews generated from prompts using Wan 2.x models.
 * Provides loading states, error handling, and regeneration controls.
 */

import React from 'react';
import { Icon } from '@/components/icons/Icon';
import { useVideoPreview } from '../hooks/useVideoPreview';

interface VideoPreviewProps {
  prompt: string;
  aspectRatio?: string | null;
  model?: string;
  isVisible: boolean;
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
  model = 'PRO',
  isVisible,
  onPreviewGenerated,
  onKeepRefining,
  onRefinePrompt,
}) => {
  const normalizedAspectRatio = React.useMemo(
    () => normalizeAspectRatio(aspectRatio),
    [aspectRatio]
  );
  
  const { videoUrl, loading, error, regenerate } = useVideoPreview({
    prompt,
    isVisible,
    aspectRatio: normalizedAspectRatio,
    model,
  });
  const [lastRequestedPrompt, setLastRequestedPrompt] = React.useState<string>('');
  const lastReportedUrlRef = React.useRef<string | null>(null);

  if (!isVisible) return null;

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

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">
            Video Preview
          </h3>
          <span className="text-xs text-geist-accents-5">Wan 2.2</span>
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
                Generating Video (approx 30-60s)...
              </span>
            </div>
          </div>
        )}
        
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-geist-error bg-geist-error/5 p-4 text-center">
            <Icon name="AlertTriangle" size={20} className="mb-2 opacity-80" />
            <span className="text-sm font-medium">Generation Failed</span>
            <span className="text-xs opacity-80 mt-1">{error}</span>
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
            <div className="absolute bottom-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-md border border-white/10 hover:bg-black/90 disabled:opacity-60"
                onClick={handleGenerate}
                aria-label="Regenerate motion preview"
                disabled={loading || !prompt}
              >
                {loading ? 'Generating...' : 'Regenerate'}
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
              aria-label="Generate Motion Preview"
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
                  name="Play" 
                  size={14} 
                  style={{ 
                    width: 'clamp(0.875rem, 1.2vw, 1rem)', 
                    height: 'clamp(0.875rem, 1.2vw, 1rem)',
                    flexShrink: 0,
                  }} 
                />
              )}
              <span className="whitespace-nowrap">{loading ? 'Generating...' : 'Generate Motion Preview'}</span>
            </button>
            <div className="mt-2 text-xs text-geist-accents-5">
              Low-fidelity · Validates composition and movement, not final quality
            </div>
          </div>
        )}
      </div>
      
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
