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
  isVisible: boolean;
}

export const VisualPreview: React.FC<VisualPreviewProps> = ({
  prompt,
  isVisible,
}) => {
  const { imageUrl, loading, error, regenerate } = useImagePreview({
    prompt,
    isVisible,
  });

  if (!isVisible) return null;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-geist-accents-5 uppercase tracking-wider">
          Visual Preview (Flux Schnell)
        </h3>
        <button
          onClick={regenerate}
          disabled={loading}
          className="p-1.5 text-geist-accents-5 hover:text-geist-foreground rounded-md hover:bg-geist-accents-2 transition-colors disabled:opacity-50"
          title="Regenerate Preview"
          aria-label="Regenerate Preview"
        >
          <div className="relative w-3.5 h-3.5">
            {loading ? (
              <div className="absolute inset-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="ArrowRight" size={14} className="rotate-180" />
            )}
          </div>
        </button>
      </div>
      <div className="relative group w-full aspect-video bg-geist-accents-1 rounded-lg overflow-hidden border border-geist-accents-2 shadow-sm">
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
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
          <div className="absolute inset-0 flex items-center justify-center text-geist-accents-4">
            <span className="text-sm">Click regenerate to generate preview</span>
          </div>
        )}
      </div>
      <div className="text-xs text-geist-accents-4 px-1 leading-relaxed">
        Previews are low-fidelity drafts using Flux Schnell. They validate
        composition and camera angles, not final render quality.
      </div>
    </div>
  );
};

