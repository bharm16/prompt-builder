import React, { useCallback, useMemo } from 'react';
import { CaretLeft, Icon, Image, Play } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { createHighlightSignature } from '@/features/span-highlighting';
import { usePromptState } from '../context/PromptStateContext';
import { formatTimestamp } from '../PromptCanvas/utils/promptCanvasFormatters';
import { cn } from '@/utils/cn';
import type { PromptVersionEdit } from '@hooks/types';
import type { HighlightSnapshot } from '../PromptCanvas/types';

type VersionEntry = {
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
  isSelected?: boolean;
  isCurrent?: boolean;
  hasPreview?: boolean;
  hasVideo?: boolean;
  preview?: unknown;
  video?: unknown;
};

const isHighlightSnapshot = (value: unknown): value is HighlightSnapshot =>
  !!value &&
  typeof value === 'object' &&
  Array.isArray((value as HighlightSnapshot).spans);

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
  const count = typeof entry.editCount === 'number'
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

type VersionsPanelProps = {
  onCollapse?: () => void;
};

export const VersionsPanel = ({ onCollapse }: VersionsPanelProps): React.ReactElement => {
  const {
    promptHistory,
    currentPromptUuid,
    currentPromptDocId,
    promptOptimizer,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    resetVersionEdits,
    activeVersionId,
    setActiveVersionId,
  } = usePromptState();

  const entry = useMemo(() => {
    if (!promptHistory?.history?.length) return null;
    return (
      promptHistory.history.find((item) => item.uuid === currentPromptUuid) ||
      promptHistory.history.find((item) => item.id === currentPromptDocId) ||
      null
    );
  }, [promptHistory.history, currentPromptUuid, currentPromptDocId]);

  const versions = useMemo<VersionEntry[]>(
    () => (entry?.versions?.filter(Boolean) as VersionEntry[]) ?? [],
    [entry]
  );

  const orderedVersions = useMemo(() => {
    if (versions.length <= 1) return versions;
    return [...versions].sort((left, right) => {
      const leftTime = resolveTimestamp(left.timestamp);
      const rightTime = resolveTimestamp(right.timestamp);
      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      return rightTime - leftTime;
    });
  }, [versions]);

  const currentSignature = useMemo(() => {
    const text = promptOptimizer?.displayedPrompt ?? '';
    return createHighlightSignature(text);
  }, [promptOptimizer?.displayedPrompt]);

  const latestVersionSignature = orderedVersions[0]?.signature ?? null;
  const hasEditsSinceLastVersion = Boolean(
    latestVersionSignature && currentSignature && latestVersionSignature !== currentSignature
  );

  const handleSelectVersion = useCallback(
    (version: VersionEntry) => {
      const versionId = typeof version.versionId === 'string' ? version.versionId : null;
      const promptText =
        typeof version.prompt === 'string' ? version.prompt : '';

      if (!promptText.trim()) return;

      setActiveVersionId(versionId);
      promptOptimizer.setOptimizedPrompt(promptText);
      setDisplayedPromptSilently(promptText);

      const highlights = isHighlightSnapshot(version.highlights) ? version.highlights : null;
      applyInitialHighlightSnapshot(highlights, { bumpVersion: true, markPersisted: false });
      resetEditStacks();
      resetVersionEdits();
    },
    [
      applyInitialHighlightSnapshot,
      promptOptimizer,
      resetEditStacks,
      resetVersionEdits,
      setActiveVersionId,
      setDisplayedPromptSilently,
    ]
  );

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-body-lg font-semibold text-foreground">Versions</div>
            <div className="mt-1 text-label-12 text-muted">Prompt snapshots</div>
          </div>
          {onCollapse ? (
            <Button
              type="button"
              variant="canvas"
              size="icon-sm"
              onClick={onCollapse}
              aria-label="Collapse versions panel"
            >
              <Icon icon={CaretLeft} size="sm" weight="bold" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      {orderedVersions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-label-12 text-muted">
          No versions yet
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {orderedVersions.map((entry, index) => {
            const isDirty = hasEditsSinceLastVersion && index === 0
              ? true
              : Boolean(entry.isDirty ?? entry.dirty);
            const versionId = typeof entry.versionId === 'string' ? entry.versionId : null;
            const isSelected = versionId && activeVersionId
              ? versionId === activeVersionId
              : index === 0;
            const hasPreview = Boolean(entry.hasPreview ?? entry.preview);
            const hasVideo = Boolean(entry.hasVideo ?? entry.video);
            const label = resolveVersionLabel(entry, index, orderedVersions.length);
            const meta = resolveMetaLabel(entry);
            const key = versionId ?? entry.id ?? `${label}-${index}`;

            return (
              <Button
                key={key}
                type="button"
                onClick={() => handleSelectVersion(entry)}
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
                {(hasPreview || hasVideo) ? (
                  <div className="inline-flex flex-shrink-0 items-center gap-2">
                    {hasPreview ? (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-3 text-faint">
                        <Icon icon={Image} size="sm" weight="bold" aria-hidden="true" />
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
          })}
        </div>
      )}
    </aside>
  );
};
