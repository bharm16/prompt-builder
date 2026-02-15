import React, { useMemo, useState } from 'react';
import { X } from '@promptstudio/system/components/ui';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type {
  Generation,
  GenerationsPanelStateSnapshot,
} from '@/features/prompt-optimizer/GenerationsPanel/types';
import { cn } from '@/utils/cn';

interface StoryboardStripProps {
  snapshot: GenerationsPanelStateSnapshot | null;
  onUseAsStartFrame: (frame: KeyframeTile) => void;
  onDismiss: () => void;
}

interface StoryboardFrame {
  id: string;
  url: string;
  assetId?: string | undefined;
  storagePath?: string | undefined;
  sourcePrompt?: string | undefined;
}

const resolveLatestStoryboardGeneration = (
  generations: Generation[]
): Generation | null => {
  const imageSequences = generations.filter(
    (generation) =>
      generation.status === 'completed' && generation.mediaType === 'image-sequence'
  );
  if (imageSequences.length === 0) return null;
  return [...imageSequences].sort((left, right) => {
    const leftTimestamp = left.completedAt ?? left.createdAt ?? 0;
    const rightTimestamp = right.completedAt ?? right.createdAt ?? 0;
    return rightTimestamp - leftTimestamp;
  })[0]!;
};

const resolveFrameAssetMetadata = (
  generation: Generation,
  frameIndex: number
): Pick<StoryboardFrame, 'assetId' | 'storagePath'> => {
  const value = generation.mediaAssetIds?.[frameIndex];
  if (!value) return {};
  if (value.includes('/')) {
    return { storagePath: value };
  }
  return { assetId: value };
};

export function StoryboardStrip({
  snapshot,
  onUseAsStartFrame,
  onDismiss,
}: StoryboardStripProps): React.ReactElement | null {
  const latestStoryboard = useMemo(
    () => resolveLatestStoryboardGeneration(snapshot?.generations ?? []),
    [snapshot?.generations]
  );

  const frames = useMemo<StoryboardFrame[]>(() => {
    if (!latestStoryboard) return [];
    return latestStoryboard.mediaUrls.slice(0, 4).map((url, frameIndex) => ({
      id: `${latestStoryboard.id}-frame-${frameIndex}`,
      url,
      sourcePrompt: latestStoryboard.prompt,
      ...resolveFrameAssetMetadata(latestStoryboard, frameIndex),
    }));
  }, [latestStoryboard]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedFrame =
    selectedIndex >= 0 && selectedIndex < frames.length
      ? frames[selectedIndex]
      : frames[0] ?? null;

  if (!latestStoryboard || frames.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2"
      data-testid="storyboard-strip"
    >
      {/* Label */}
      <span className="flex-shrink-0 text-[10px] font-semibold tracking-[0.05em] text-[#3A3E4C]">
        PREVIEW
      </span>

      {/* Frame thumbnails */}
      <div className="flex gap-1.5">
        {frames.map((frame, index) => (
          <button
            key={frame.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={cn(
              'h-11 w-[72px] flex-shrink-0 overflow-hidden rounded-lg border-2 outline-none transition-all',
              selectedIndex === index
                ? 'border-[#6C5CE7] opacity-100 shadow-[0_0_12px_#6C5CE744]'
                : 'border-transparent opacity-70 hover:opacity-100'
            )}
            data-testid={`storyboard-frame-${index}`}
          >
            <img
              src={frame.url}
              alt={`Frame ${index + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Use as start frame */}
      <button
        type="button"
        className="h-[26px] flex-shrink-0 rounded-md border border-[#6C5CE744] bg-[#6C5CE711] px-2.5 text-[11px] font-semibold text-[#6C5CE7] transition-colors hover:bg-[#6C5CE71A] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!selectedFrame}
        data-testid="storyboard-use-start-frame"
        onClick={() => {
          if (!selectedFrame) return;
          onUseAsStartFrame({
            id: `storyboard-${selectedFrame.id}`,
            url: selectedFrame.url,
            source: 'generation',
            ...(selectedFrame.sourcePrompt
              ? { sourcePrompt: selectedFrame.sourcePrompt }
              : {}),
            ...(selectedFrame.assetId ? { assetId: selectedFrame.assetId } : {}),
            ...(selectedFrame.storagePath
              ? { storagePath: selectedFrame.storagePath }
              : {}),
          });
        }}
      >
        Use as start frame
      </button>

      <div className="flex-1" />

      {/* Dismiss */}
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[#3A3E4C] transition-colors hover:text-[#555B6E]"
        onClick={onDismiss}
        data-testid="storyboard-dismiss"
        aria-label="Dismiss storyboard"
      >
        <X size={10} />
      </button>
    </div>
  );
}
