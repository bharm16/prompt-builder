import React, { useCallback, useMemo } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
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
    <div className="h-full flex flex-col px-3 py-3 gap-3 rounded-2xl bg-white/70 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] font-semibold tracking-[-0.01em] text-zinc-800">Versions</div>
        {orderedVersions.length > 0 ? (
          <div className="text-[12px] font-medium text-zinc-500">{orderedVersions.length}</div>
        ) : null}
      </div>
      {orderedVersions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[12px] font-medium text-zinc-500">
          No versions yet
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-200/80">
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
                className={cn(
                  'group relative flex items-center gap-2 rounded-xl px-2.5 py-2 bg-white/60 hover:bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition transform-gpu hover:-translate-y-[1px] text-left w-full',
                  isSelected && 'bg-white ring-1 ring-zinc-900/10 shadow-[0_10px_28px_rgba(0,0,0,0.10)]'
                )}
                aria-pressed={isSelected}
              >
                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {isDirty ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]" />
                    ) : null}
                    <div className="truncate text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                      {label}
                    </div>
                  </div>
                  <div className="text-[12px] font-medium text-zinc-500">{meta}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasPreview ? (
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 ring-1 ring-zinc-900/5 overflow-hidden flex items-center justify-center text-zinc-500">
                      <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    </div>
                  ) : null}
                  {hasVideo ? (
                    <div className="h-9 px-2.5 rounded-lg bg-zinc-900 text-white flex items-center gap-1.5 text-[12px] font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
                      <Play className="w-4 h-4 text-white/90" aria-hidden="true" />
                      <span>Video</span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
