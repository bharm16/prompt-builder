import React from 'react';
import {
  CaretDown,
  CaretLeft,
  CaretUp,
  Icon,
  List,
  Plus,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { VersionRow, type VersionEntry } from './VersionRow';

interface VersionsPanelProps {
  versions: VersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (id: string) => void;
  onCreateVersion: () => void;
  isCompact?: boolean;
  onExpandDrawer?: () => void;
  onCollapseDrawer?: () => void;
  /** Layout direction - 'vertical' for left drawer, 'horizontal' for bottom drawer */
  layout?: 'vertical' | 'horizontal';
}

const resolveEntryId = (entry: VersionEntry): string | null => {
  if (typeof entry.versionId === 'string' && entry.versionId.trim()) {
    return entry.versionId.trim();
  }
  if (typeof entry.id === 'string' && entry.id.trim()) {
    return entry.id.trim();
  }
  return null;
};

export const VersionsPanel = ({
  versions,
  selectedVersionId,
  onSelectVersion,
  onCreateVersion,
  isCompact = false,
  onExpandDrawer,
  onCollapseDrawer,
  layout = 'vertical',
}: VersionsPanelProps): React.ReactElement => {
  const orderedVersions = versions ?? [];
  const fallbackId = orderedVersions[0]
    ? resolveEntryId(orderedVersions[0])
    : null;
  const resolvedSelectedId = selectedVersionId || fallbackId || '';
  const currentVersion =
    orderedVersions.find((entry) => {
      const entryId = resolveEntryId(entry);
      return entryId && entryId === resolvedSelectedId;
    }) ??
    orderedVersions[0] ??
    null;
  const versionCount = orderedVersions.length;

  // Horizontal layout (bottom drawer)
  if (layout === 'horizontal') {
    const compactLabel = `${versionCount} version${versionCount === 1 ? '' : 's'} - Click to expand`;

    // Compact horizontal bar
    if (isCompact) {
      return (
        <button
          type="button"
          className="gap-ps-3 border-border bg-surface-2 px-ps-4 hover:bg-surface-3 group flex h-full w-full items-center justify-between rounded-t-xl border text-left shadow-sm transition-colors"
          onClick={onExpandDrawer}
          title={compactLabel}
          aria-label={compactLabel}
        >
          <div className="gap-ps-3 flex min-w-0 items-center">
            <span className="border-border bg-surface-3 text-label-sm text-foreground inline-flex items-center rounded-md border px-2 py-1 font-semibold">
              v{versionCount}
            </span>
            {currentVersion ? (
              <span className="text-label-sm text-muted min-w-0 truncate">
                {currentVersion.label ?? 'Current'}
              </span>
            ) : (
              <span className="text-label-sm text-muted">Versions</span>
            )}
          </div>
          <span
            className="border-border bg-surface-3 text-muted group-hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            title="Toggle versions (`)"
          >
            <Icon icon={CaretUp} size="sm" weight="bold" aria-hidden="true" />
          </span>
        </button>
      );
    }

    // Expanded horizontal filmstrip
    return (
      <aside className="border-border bg-surface-2 flex h-full w-full flex-col overflow-hidden rounded-t-xl border">
        {/* Header */}
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="text-body-sm text-foreground font-semibold">
              Versions
            </div>
            <span className="text-label-12 text-muted">
              {versionCount} snapshots
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="canvas"
              size="icon-sm"
              onClick={onCreateVersion}
              aria-label="Create version"
              title="Create version"
            >
              <Icon icon={Plus} size="sm" weight="bold" aria-hidden="true" />
            </Button>
            {onCollapseDrawer ? (
              <Button
                type="button"
                variant="canvas"
                size="icon-sm"
                onClick={onCollapseDrawer}
                aria-label="Collapse versions panel"
                title="Toggle versions (`)"
              >
                <Icon
                  icon={CaretDown}
                  size="sm"
                  weight="bold"
                  aria-hidden="true"
                />
              </Button>
            ) : null}
          </div>
        </div>

        {/* Horizontal scrolling filmstrip */}
        {orderedVersions.length === 0 ? (
          <div className="text-label-12 text-muted flex flex-1 items-center justify-center">
            No versions yet
          </div>
        ) : (
          <div className="flex flex-1 items-stretch gap-3 overflow-x-auto px-3 py-3">
            {orderedVersions.map((entry, index) => {
              const versionId = resolveEntryId(entry);
              const isSelected = versionId
                ? versionId === resolvedSelectedId
                : index === 0;
              const key = versionId ?? `${entry.label ?? 'v'}-${index}`;

              return (
                <VersionRow
                  key={key}
                  entry={entry}
                  index={index}
                  total={orderedVersions.length}
                  isSelected={isSelected}
                  onSelect={() => {
                    if (!versionId) return;
                    onSelectVersion(versionId);
                  }}
                  layout="horizontal"
                />
              );
            })}
          </div>
        )}
      </aside>
    );
  }

  // Original vertical layout (left drawer)
  const compactLabel = `${versionCount} version${versionCount === 1 ? '' : 's'} - Click to expand`;

  if (isCompact) {
    return (
      <button
        type="button"
        className="border-border bg-surface-2 group flex h-full w-12 flex-col items-center gap-4 rounded-xl border py-4 text-left shadow-sm"
        onClick={onExpandDrawer}
        title={compactLabel}
        aria-label={compactLabel}
      >
        <span
          className="border-border bg-surface-3 text-muted group-hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
          title="Toggle versions ([)"
        >
          <Icon
            icon={CaretLeft}
            size="sm"
            weight="bold"
            aria-hidden="true"
            className="rotate-180"
          />
        </span>
        <div className="relative flex items-center justify-center">
          <Icon
            icon={List}
            size="md"
            weight="bold"
            aria-hidden="true"
            className="text-muted"
          />
          <span className="bg-accent text-app absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {versionCount}
          </span>
        </div>
        {currentVersion ? (
          <span
            className="bg-accent ring-accent/30 h-2 w-2 rounded-full ring-2"
            title={currentVersion.label ?? 'Current version'}
          />
        ) : null}
      </button>
    );
  }

  return (
    <aside className="border-border bg-surface-2 flex h-full flex-col overflow-hidden rounded-xl border">
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-body-lg text-foreground font-semibold">
              Versions
            </div>
            <div className="text-label-12 text-muted mt-1">
              Prompt snapshots
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="canvas"
              size="icon-sm"
              onClick={onCreateVersion}
              aria-label="Create version"
              title="Create version"
            >
              <Icon icon={Plus} size="sm" weight="bold" aria-hidden="true" />
            </Button>
            {onCollapseDrawer ? (
              <Button
                type="button"
                variant="canvas"
                size="icon-sm"
                onClick={onCollapseDrawer}
                aria-label="Collapse versions panel"
                title="Toggle versions ([)"
              >
                <Icon
                  icon={CaretLeft}
                  size="sm"
                  weight="bold"
                  aria-hidden="true"
                />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {orderedVersions.length === 0 ? (
        <div className="text-label-12 text-muted flex flex-1 items-center justify-center">
          No versions yet
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {orderedVersions.map((entry, index) => {
            const versionId = resolveEntryId(entry);
            const isSelected = versionId
              ? versionId === resolvedSelectedId
              : index === 0;
            const key = versionId ?? `${entry.label ?? 'v'}-${index}`;

            return (
              <VersionRow
                key={key}
                entry={entry}
                index={index}
                total={orderedVersions.length}
                isSelected={isSelected}
                onSelect={() => {
                  if (!versionId) return;
                  onSelectVersion(versionId);
                }}
              />
            );
          })}
        </div>
      )}
    </aside>
  );
};
