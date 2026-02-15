import React from 'react';
import { cn } from '@/utils/cn';
import type { VersionEntry } from '@/features/prompt-optimizer/components/VersionRow';

interface CanvasVersionStripProps {
  versions: VersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
}

const resolveVersionId = (entry: VersionEntry): string | null => {
  if (typeof entry.versionId === 'string' && entry.versionId.trim()) return entry.versionId;
  if (typeof entry.id === 'string' && entry.id.trim()) return entry.id;
  return null;
};

const resolveThumbnail = (entry: VersionEntry): string | null => {
  const previewImage = entry.preview?.imageUrl;
  if (typeof previewImage === 'string' && previewImage.trim()) {
    return previewImage;
  }
  if (typeof entry.thumbnailUrl === 'string' && entry.thumbnailUrl.trim()) {
    return entry.thumbnailUrl;
  }
  const generationThumbnail = entry.generations?.find((generation) => generation.thumbnailUrl)?.thumbnailUrl;
  if (typeof generationThumbnail === 'string' && generationThumbnail.trim()) {
    return generationThumbnail;
  }
  return null;
};

const resolveLabel = (entry: VersionEntry, index: number, total: number): string => {
  if (typeof entry.label === 'string' && entry.label.trim()) return entry.label;
  if (typeof entry.version === 'number' && Number.isFinite(entry.version)) return `v${entry.version}`;
  return `v${total - index}`;
};

export function CanvasVersionStrip({
  versions,
  selectedVersionId,
  onSelectVersion,
}: CanvasVersionStripProps): React.ReactElement {
  if (versions.length === 0) {
    return (
      <aside className="hidden w-20 flex-none border-r border-[#1A1C22] bg-[#0D0E12] lg:flex lg:items-center lg:justify-center">
        <span className="text-[10px] text-[#555B6E]">No versions</span>
      </aside>
    );
  }

  return (
    <aside className="hidden w-20 flex-none border-r border-[#1A1C22] bg-[#0D0E12] px-2 py-3 lg:block">
      <div className="flex h-full flex-col gap-2 overflow-y-auto">
        {versions.map((entry, index) => {
          const versionId = resolveVersionId(entry);
          const isSelected = Boolean(versionId && versionId === selectedVersionId);
          const thumbnail = resolveThumbnail(entry);
          const label = resolveLabel(entry, index, versions.length);
          const key = versionId ?? `${label}-${index}`;

          return (
            <button
              key={key}
              type="button"
              className={cn(
                'group flex w-full flex-col items-center gap-1 rounded-md border p-1 transition-colors',
                isSelected
                  ? 'border-[#6C5CE7] bg-[#6C5CE71A]'
                  : 'border-[#22252C] bg-[#111318] hover:border-[#3A3D46]'
              )}
              onClick={() => {
                if (versionId) onSelectVersion(versionId);
              }}
              aria-pressed={isSelected}
            >
              <div className="relative h-9 w-full overflow-hidden rounded-sm bg-[#16181E]">
                {thumbnail ? (
                  <img src={thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full w-full bg-[#1A1C22]" />
                )}
              </div>
              <span className="truncate text-[10px] font-medium text-[#8B92A5]">{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
