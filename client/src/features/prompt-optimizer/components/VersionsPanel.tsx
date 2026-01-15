import React, { useCallback, useMemo } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';
import { createHighlightSignature } from '@/features/span-highlighting';
import { usePromptState } from '../context/PromptStateContext';
import { formatTimestamp } from '../PromptCanvas/utils/promptCanvasFormatters';
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

export const VersionsPanel = (): React.ReactElement => {
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
    <aside className="po-sessions-panel">
      <div className="po-sessions-panel__header">
        <div className="po-sessions-panel__title">Sessions</div>
        <div className="po-sessions-panel__subtitle">Versions &amp; runs</div>
      </div>
      {orderedVersions.length === 0 ? (
        <div className="po-sessions-panel__empty">No sessions yet</div>
      ) : (
        <div className="po-sessions-panel__list">
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
              <button
                key={key}
                type="button"
                onClick={() => handleSelectVersion(entry)}
                className="po-session-item"
                data-active={isSelected ? 'true' : 'false'}
                aria-pressed={isSelected}
              >
                <div className="po-session-item__body">
                  <div className="po-session-item__title-row">
                    {isDirty ? (
                      <span className="po-session-item__dirty" aria-hidden="true" />
                    ) : null}
                    <div className="po-session-item__title">{label}</div>
                  </div>
                  <div className="po-session-item__meta">{meta}</div>
                </div>
                {(hasPreview || hasVideo) ? (
                  <div className="po-session-item__media">
                    {hasPreview ? (
                      <div className="po-session-item__thumb">
                        <ImageIcon className="h-4 w-4" aria-hidden="true" />
                      </div>
                    ) : null}
                    {hasVideo ? (
                      <div className="po-session-item__video">
                        <Play className="w-4 h-4" aria-hidden="true" />
                        <span>Video</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
