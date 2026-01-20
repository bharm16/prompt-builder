import React from 'react';
import { Icon, Image, Play } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { formatTimestamp } from '../PromptCanvas/utils/promptCanvasFormatters';
import { cn } from '@/utils/cn';
import type { PromptVersionEdit } from '@hooks/types';

type VersionPreview = {
  generatedAt?: string;
  imageUrl?: string | null;
  aspectRatio?: string | null;
};

export type VersionEntry = {
  id?: string;
  versionId?: string;
  label?: string;
  version?: string | number;
  meta?: string;
  edits?: PromptVersionEdit[] | number;
  editCount?: number;
  timestamp?: string | number;
  signature?: string;
  prompt?: string;
  highlights?: unknown | null;
  isDirty?: boolean;
  dirty?: boolean;
  hasPreview?: boolean;
  hasVideo?: boolean;
  preview?: VersionPreview | null;
  video?: unknown;
};

interface VersionRowProps {
  entry: VersionEntry;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  /** Layout direction */
  layout?: 'vertical' | 'horizontal';
}

const resolvePreviewImageUrl = (entry: VersionEntry): string | null => {
  if (!entry.preview) return null;
  const url = entry.preview.imageUrl;
  if (typeof url === 'string' && url.trim()) {
    return url.trim();
  }
  return null;
};

const resolveTimestamp = (value: VersionEntry['timestamp']): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return null;
};

const resolveMetaLabel = (entry: VersionEntry): string => {
  if (typeof entry.meta === 'string' && entry.meta.trim()) {
    return entry.meta.trim();
  }
  const count =
    typeof entry.editCount === 'number'
      ? entry.editCount
      : Array.isArray(entry.edits)
        ? entry.edits.length
        : typeof entry.edits === 'number'
          ? entry.edits
          : null;
  if (typeof count === 'number' && Number.isFinite(count)) {
    return `${count} edit${count === 1 ? '' : 's'}`;
  }
  const timestamp = resolveTimestamp(entry.timestamp);
  if (timestamp !== null) {
    return formatTimestamp(timestamp);
  }
  return '';
};

const resolveVersionLabel = (entry: VersionEntry, index: number, total: number): string => {
  if (typeof entry.label === 'string' && entry.label.trim()) {
    return entry.label.trim();
  }
  if (typeof entry.version === 'string' && entry.version.trim()) {
    return entry.version.trim();
  }
  if (typeof entry.version === 'number' && Number.isFinite(entry.version)) {
    return `v${entry.version}`;
  }
  return `v${total - index}`;
};

export function VersionRow({
  entry,
  index,
  total,
  isSelected,
  onSelect,
  layout = 'vertical',
}: VersionRowProps): React.ReactElement {
  const previewImageUrl = resolvePreviewImageUrl(entry);
  const hasPreview = Boolean(entry.hasPreview ?? entry.preview);
  const hasVideo = Boolean(entry.hasVideo ?? entry.video);
  const label = resolveVersionLabel(entry, index, total);
  const meta = resolveMetaLabel(entry);
  const isDirty = Boolean(entry.isDirty ?? entry.dirty);

  // Horizontal layout (filmstrip card)
  if (layout === 'horizontal') {
    return (
      <Button
        type="button"
        onClick={onSelect}
        className={cn(
          'relative flex h-full min-w-[140px] max-w-[180px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 p-3 text-center transition-colors hover:border-border-strong',
          isSelected && 'border-accent/50 ring-2 ring-accent/10'
        )}
        data-active={isSelected ? 'true' : 'false'}
        aria-pressed={isSelected}
        variant="ghost"
      >
        {isSelected && (
          <span className="absolute bottom-0 left-0 h-1 w-full rounded-b-lg bg-accent" aria-hidden="true" />
        )}
        
        {/* Preview thumbnail */}
        <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-md border border-border bg-surface-3">
          {previewImageUrl ? (
            <img
              src={previewImageUrl}
              alt={`${label} preview`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : hasVideo ? (
            <Icon icon={Play} size="lg" weight="bold" aria-hidden="true" className="text-muted" />
          ) : (
            <Icon icon={Image} size="lg" weight="bold" aria-hidden="true" className="text-faint" />
          )}
        </div>
        
        {/* Label and meta */}
        <div className="flex w-full flex-col gap-0.5">
          <div className="flex items-center justify-center gap-1.5">
            {isDirty ? (
              <span className="h-2 w-2 rounded-full bg-warning ring-2 ring-warning/40" aria-hidden="true" />
            ) : null}
            <span className="truncate text-body-sm font-semibold text-foreground">{label}</span>
          </div>
          {meta ? (
            <span className="truncate text-label-12 text-muted">{meta}</span>
          ) : null}
        </div>
      </Button>
    );
  }

  // Original vertical layout
  return (
    <Button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex h-14 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 text-left transition-colors hover:border-border-strong',
        isSelected && 'border-accent/50 ring-2 ring-accent/10'
      )}
      data-active={isSelected ? 'true' : 'false'}
      aria-pressed={isSelected}
      variant="ghost"
    >
      {isSelected && (
        <span className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-accent" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          {isDirty ? (
            <span className="h-2 w-2 rounded-full bg-warning ring-2 ring-warning/40" aria-hidden="true" />
          ) : null}
          <div className="truncate text-body-sm font-semibold text-foreground">{label}</div>
        </div>
        <div className="text-label-12 text-muted">{meta}</div>
      </div>
      {hasPreview || hasVideo ? (
        <div className="inline-flex flex-shrink-0 items-center gap-2">
          {hasPreview ? (
            <div className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-3 text-faint">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={`${label} preview`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Icon icon={Image} size="sm" weight="bold" aria-hidden="true" />
              )}
            </div>
          ) : null}
          {hasVideo ? (
            <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2 text-label-sm font-semibold text-muted">
              <Icon icon={Play} size="sm" weight="bold" aria-hidden="true" />
              <span>Video</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Button>
  );
}
