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

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">
          Video Preview (Wan 2.2)
        </h3>
        <button
          onClick={regenerate}
          disabled={loading}
          className="p-1.5 text-geist-accents-5 hover:text-geist-foreground rounded-md hover:bg-geist-accents-2 transition-colors disabled:opacity-50"
          title="Generate Video"
          aria-label="Generate Video"
        >
          <div className="relative w-3.5 h-3.5">
            {loading ? (
              <div className="absolute inset-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="Play" size={14} />
            )}
          </div>
        </button>
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
              // Force error state if video fails to load
              const target = e.target as HTMLVideoElement;
              if (target.error) {
                 console.error('Media Error Details:', target.error);
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-geist-accents-4 bg-geist-accents-1">
            <span className="text-sm">Click play to generate video preview</span>
          </div>
        )}
      </div>
      
      <div className="text-xs text-geist-accents-4 px-1 leading-relaxed">
        Video previews use Alibaba's Wan 2.2. These take longer to generate but 
        provide a high-fidelity look at motion and cinematic quality.
      </div>
    </div>
  );
};
