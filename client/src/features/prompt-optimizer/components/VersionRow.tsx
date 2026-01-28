import React from 'react';
import { Icon, Image, Play } from '@promptstudio/system/components/ui';
import { Badge } from '@promptstudio/system/components/ui/badge';
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
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'ps-card-interactive',
          'snap-start',
          'relative flex h-[120px] min-w-[160px] max-w-[180px] flex-shrink-0 flex-col items-center justify-start',
          'gap-2 rounded-lg border p-3 text-center',
          isSelected
            ? 'border-2 border-[rgb(104,134,255)] bg-[rgb(36,42,56)]'
            : 'border border-[rgb(44,48,55)] bg-[rgb(36,40,47)] hover:bg-[rgb(36,42,56)]'
        )}
        data-active={isSelected ? 'true' : 'false'}
        aria-pressed={isSelected}
      >
        {/* Preview thumbnail */}
        <div
          className={cn(
            'ps-thumb-frame flex w-full items-center justify-center',
            'h-16 overflow-hidden rounded-[6px]',
            !previewImageUrl && !hasVideo && 'ps-thumb-placeholder'
          )}
        >
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
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center justify-center gap-2">
            {isDirty ? (
              <span
                className="h-ps-1 w-ps-1 rounded-full bg-warning ring-2 ring-warning/30 ps-animate-active-dot-pulse"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                'truncate font-semibold',
                isSelected
                  ? 'text-label-14 text-foreground'
                  : 'text-body-sm text-muted'
              )}
            >
              {label}
            </span>
            {isSelected && index === 0 ? (
              <span className="inline-flex items-center rounded-full bg-[rgb(44,48,55)] px-[6px] py-[2px] text-[11px] font-semibold text-[rgb(235,236,239)]">
                Current
              </span>
            ) : null}
          </div>
          {meta ? (
            <span className="truncate text-[11px] font-medium text-muted">{meta}</span>
          ) : null}
        </div>
      </button>
    );
  }

  // Original vertical layout
  return (
    <Button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex h-ps-10 w-full items-center justify-between gap-ps-3 rounded-lg border border-border bg-surface-2 px-ps-3 text-left transition-colors hover:border-border-strong',
        isSelected && 'border-accent/50 ring-2 ring-accent/10'
      )}
      data-active={isSelected ? 'true' : 'false'}
      aria-pressed={isSelected}
      variant="ghost"
    >
      {isSelected && (
        <span className="absolute left-0 top-0 h-full w-ps-1 rounded-l-lg bg-accent" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-ps-1">
        <div className="flex min-w-0 items-center gap-ps-2">
          {isDirty ? (
            <span
              className="h-ps-1 w-ps-1 rounded-full bg-warning ring-2 ring-warning/30 ps-animate-active-dot-pulse"
              aria-hidden="true"
            />
          ) : null}
          <div className="truncate text-body-sm font-semibold text-foreground">{label}</div>
        </div>
        <div className="text-label-12 text-muted">{meta}</div>
      </div>
      {hasPreview || hasVideo ? (
        <div className="inline-flex flex-shrink-0 items-center gap-ps-2">
          {hasPreview ? (
            <div className="inline-flex h-ps-7 w-ps-7 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-3 text-faint">
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
            <div className="inline-flex h-ps-7 items-center gap-ps-1 rounded-md border border-border bg-surface-3 px-ps-2 text-label-sm font-semibold text-muted">
              <Icon icon={Play} size="sm" weight="bold" aria-hidden="true" />
              <span>Video</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Button>
  );
}
