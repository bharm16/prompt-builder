/**
 * Tabbed Preview Component
 *
 * Combines VisualPreview and VideoPreview in a tabbed interface.
 * Allows users to switch between image and video previews.
 */

import React, { useState } from 'react';
import { VisualPreview } from './VisualPreview';
import { VideoPreview } from './VideoPreview';

interface TabbedPreviewProps {
  visualPrompt: string;
  videoPrompt: string;
  aspectRatio?: string | null;
  isVisible: boolean;
  selectedMode?: string;
  onActiveTabChange?: ((tab: 'visual' | 'video') => void) | undefined;
  onVisualPreviewGenerated?: ((payload: { prompt: string; generatedAt: number }) => void) | undefined;
  onVideoPreviewGenerated?: ((payload: { prompt: string; generatedAt: number }) => void) | undefined;
  onKeepRefining?: (() => void) | undefined;
  onRefinePrompt?: (() => void) | undefined;
}

type TabType = 'visual' | 'video';

export const TabbedPreview: React.FC<TabbedPreviewProps> = ({
  visualPrompt,
  videoPrompt,
  aspectRatio,
  isVisible,
  selectedMode = 'video',
  onActiveTabChange,
  onVisualPreviewGenerated,
  onVideoPreviewGenerated,
  onKeepRefining,
  onRefinePrompt,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('visual');

  // Only show video tab if in video mode
  const showVideoTab = selectedMode === 'video';

  React.useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-1 border-b border-geist-accents-2">
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === 'visual'
                ? 'text-geist-foreground border-geist-foreground'
                : 'text-geist-accents-5 border-transparent hover:text-geist-accents-7'
            }`}
            aria-label="Visual Preview"
            aria-selected={activeTab === 'visual'}
            role="tab"
          >
            Visual Preview
          </button>
          {showVideoTab && (
            <button
              onClick={() => setActiveTab('video')}
              className={`px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                activeTab === 'video'
                  ? 'text-geist-foreground border-geist-foreground'
                  : 'text-geist-accents-5 border-transparent hover:text-geist-accents-7'
              }`}
              aria-label="Video Preview"
              aria-selected={activeTab === 'video'}
              role="tab"
            >
              Video Preview
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'visual' ? (
          <VisualPreview
            prompt={visualPrompt}
            aspectRatio={aspectRatio}
            isVisible={true}
            onPreviewGenerated={onVisualPreviewGenerated}
            onKeepRefining={onKeepRefining}
            onRefinePrompt={onRefinePrompt}
          />
        ) : showVideoTab ? (
          <VideoPreview
            prompt={videoPrompt}
            aspectRatio={aspectRatio}
            isVisible={true}
            onPreviewGenerated={onVideoPreviewGenerated}
            onKeepRefining={onKeepRefining}
            onRefinePrompt={onRefinePrompt}
          />
        ) : null}
      </div>
    </div>
  );
};

