import React, { useMemo, useState } from 'react';
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
      className="border-t border-[#1A1C22] bg-[#0F1117] px-3 py-2.5"
      data-testid="storyboard-strip"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-[#E2E6EF]">
            Storyboard Preview
          </p>
          <p className="text-[11px] text-[#8B92A5]">
            Select a frame and use it as your start frame.
          </p>
        </div>
        <button
          type="button"
          className="h-7 rounded-md border border-[#22252C] bg-[#111318] px-2 text-[11px] font-semibold text-[#8B92A5] transition-colors hover:border-[#3A3D46]"
          onClick={onDismiss}
          data-testid="storyboard-dismiss"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {frames.map((frame, index) => (
          <button
            key={frame.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={cn(
              'overflow-hidden rounded-lg border transition-colors',
              selectedIndex === index
                ? 'border-[#6C5CE7]'
                : 'border-[#22252C] hover:border-[#3A3D46]'
            )}
            data-testid={`storyboard-frame-${index}`}
          >
            <img
              src={frame.url}
              alt={`Storyboard frame ${index + 1}`}
              className="h-16 w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="h-8 rounded-lg border border-[#6C5CE7] bg-[#6C5CE7] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>
    </div>
  );
}
