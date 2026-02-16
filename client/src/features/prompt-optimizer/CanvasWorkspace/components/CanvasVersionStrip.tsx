import React from 'react';
import { Plus } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import type { PromptVersionEntry } from '@/hooks/types';

interface CanvasVersionStripProps {
  versions: PromptVersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
}

const resolveVersionId = (entry: PromptVersionEntry): string | null => {
  if ('versionId' in entry && typeof entry.versionId === 'string' && entry.versionId.trim()) return entry.versionId;
  if ('id' in entry && typeof entry.id === 'string' && entry.id.trim()) return entry.id;
  return null;
};

const resolveThumbnail = (entry: PromptVersionEntry): string | null => {
  if ('preview' in entry && entry.preview && typeof entry.preview === 'object') {
    const previewImageUrl = entry.preview.imageUrl;
    if (typeof previewImageUrl === 'string' && previewImageUrl.trim()) return previewImageUrl;
  }
  if ('thumbnailUrl' in entry && typeof entry.thumbnailUrl === 'string' && entry.thumbnailUrl.trim()) {
    return entry.thumbnailUrl;
  }
  return null;
};

/**
 * Floating version strip — absolutely positioned on the left edge of the canvas.
 * Parent must be `position: relative`.
 * @deprecated Canvas-first now uses CanvasGenerationStrip. Kept for legacy paths.
 */
export function CanvasVersionStrip({
  versions,
  selectedVersionId,
  onSelectVersion,
}: CanvasVersionStripProps): React.ReactElement {
  return (
    <div
      className="absolute left-5 top-1/2 z-20 flex -translate-y-[60%] flex-col items-center gap-2"
      data-testid="canvas-version-strip"
    >
      {/* New version button */}
      <button
        type="button"
        className="flex h-[57px] w-[57px] items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#22252C] bg-[#141519]/50 text-[#3A3E4C] backdrop-blur-xl transition-colors hover:border-[#3A3E4C] hover:text-[#555B6E]"
        aria-label="New version"
      >
        <Plus size={14} />
      </button>

      {/* Version thumbnails */}
      {versions.map((entry, index) => {
        const versionId = resolveVersionId(entry);
        const isActive = Boolean(versionId && versionId === selectedVersionId);
        const thumbnail = resolveThumbnail(entry);
        const label = `v${versions.length - index}`;
        const key = versionId ?? `version-${index}`;

        return (
          <button
            key={key}
            type="button"
            className={cn(
              'relative h-[57px] w-[57px] overflow-hidden rounded-[10px] border-2 outline-none transition-all',
              isActive
                ? 'border-[#E2E6EF] opacity-100'
                : 'border-transparent opacity-60 hover:opacity-[0.85]'
            )}
            onClick={() => {
              if (versionId) onSelectVersion(versionId);
            }}
            aria-pressed={isActive}
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={label}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1a2a1a] to-[#0a1a0a]" />
            )}
            <span className="absolute bottom-[3px] right-1 text-[8px] font-bold text-white/60">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
