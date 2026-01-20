import React from 'react';
import {
  Badge,
  CaretDown,
  CaretLeft,
  Icon,
  List,
  Plus,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@promptstudio/system/components/ui/tooltip';
import { cn } from '@/utils/cn';
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
    const isExpanded = !isCompact;
    const chevronClass = `ps-transition-transform${isExpanded ? '' : ' rotate-180'}`;

    // Compact horizontal bar - Premium cinematic style
    if (isCompact) {
      return (
        <button
          type="button"
          className={cn(
            'ps-glass ps-edge-lit group',
            'flex h-full w-full items-center justify-between',
            'gap-ps-3 px-ps-4',
            'rounded-t-xl border-t border-x border-border/60',
            'text-left transition-all duration-200',
            'shadow-[0_-4px_16px_rgba(0,0,0,0.25)]',
            'hover:shadow-[0_-6px_24px_rgba(0,0,0,0.35)]',
            'hover:border-border'
          )}
          onClick={onExpandDrawer}
          title={compactLabel}
          aria-label={compactLabel}
        >
          <div className="gap-ps-3 flex min-w-0 items-center">
            {/* Version badge with accent glow */}
            <span
              className={cn(
                'inline-flex items-center gap-ps-1',
                'rounded-md px-ps-2 py-ps-1',
                'bg-accent/15 border border-accent/30',
                'text-label-sm text-accent font-semibold',
                'shadow-[0_0_8px_rgba(104,134,255,0.15)]'
              )}
            >
              <Icon icon={List} size="xs" weight="bold" aria-hidden="true" />
              <span>{versionCount}</span>
            </span>
            {currentVersion ? (
              <span className="text-body-sm text-muted min-w-0 truncate group-hover:text-foreground transition-colors">
                {currentVersion.label ?? 'Current version'}
              </span>
            ) : (
              <span className="text-body-sm text-muted group-hover:text-foreground transition-colors">
                Versions
              </span>
            )}
          </div>
          {/* Expand indicator */}
          <div className="flex items-center gap-ps-2">
            <span className="text-label-xs text-faint hidden sm:block group-hover:text-muted transition-colors">
              Click to expand
            </span>
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center',
                'rounded-lg border border-border/60',
                'bg-surface-3/50 backdrop-blur-sm',
                'text-muted group-hover:text-foreground',
                'group-hover:border-border group-hover:bg-surface-3',
                'transition-all duration-200'
              )}
              title="Toggle versions (`)"
            >
              <Icon
                icon={CaretDown}
                size="sm"
                weight="bold"
                aria-hidden="true"
                className={cn('transition-transform duration-200', !isExpanded && 'rotate-180')}
              />
            </span>
          </div>
        </button>
      );
    }

    // Expanded horizontal filmstrip
    return (
      <aside className="border-border bg-surface-2 flex h-full w-full flex-col overflow-hidden rounded-t-xl border shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        {/* Header */}
        <TooltipProvider delayDuration={120}>
          <div className="border-border flex items-center justify-between gap-ps-3 border-b px-ps-4 py-ps-2">
            <div className="flex items-center gap-ps-2">
              <Icon icon={List} size="sm" weight="bold" className="text-muted" />
              <span className="text-label-14 font-semibold text-foreground">
                Versions
              </span>
              <Badge variant="subtle" size="xs">
                {versionCount}
              </Badge>
            </div>
            <div className="flex items-center gap-ps-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="canvas"
                    size="icon-sm"
                    onClick={onCreateVersion}
                    aria-label="Create snapshot"
                  >
                    <Icon icon={Plus} size="sm" weight="bold" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="ps-glass-subtle border-border/60 text-body-sm text-foreground"
                >
                  <span>Create snapshot</span>
                </TooltipContent>
              </Tooltip>
              {onCollapseDrawer ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="canvas"
                      size="icon-sm"
                      onClick={onCollapseDrawer}
                      aria-label="Collapse versions panel"
                    >
                      <Icon
                        icon={CaretDown}
                        size="sm"
                        weight="bold"
                        aria-hidden="true"
                        className={chevronClass}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="ps-glass-subtle border-border/60 text-body-sm text-foreground"
                  >
                    <span>Toggle versions (`)</span>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </TooltipProvider>

        {/* Horizontal scrolling filmstrip */}
        {orderedVersions.length === 0 ? (
          <div className="text-label-12 text-muted flex flex-1 items-center justify-center">
            No versions yet
          </div>
        ) : (
          <div className="relative flex-1 overflow-hidden">
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-ps-6 bg-gradient-to-r from-surface-2 to-transparent" />
            <div className="ps-scrollbar-thin flex h-full items-stretch gap-ps-3 overflow-x-auto px-ps-4 py-ps-3">
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
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-ps-6 bg-gradient-to-l from-surface-2 to-transparent" />
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
        className="border-border bg-surface-2 group flex h-full w-ps-9 flex-col items-center gap-ps-4 rounded-xl border py-ps-4 text-left shadow-sm"
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
          <span className="bg-accent text-app absolute -right-ps-3 -top-ps-2 flex h-ps-4 min-w-ps-4 items-center justify-center rounded-full px-ps-1 text-[10px] font-semibold">
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
      <div className="px-ps-4 pb-ps-3 pt-ps-4">
        <TooltipProvider delayDuration={120}>
          <div className="flex items-start justify-between gap-ps-3">
            <div>
              <div className="text-body-lg text-foreground font-semibold">
                Versions
              </div>
              <div className="text-label-12 text-muted mt-ps-1">
                Prompt snapshots
              </div>
            </div>
            <div className="flex items-center gap-ps-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="canvas"
                    size="icon-sm"
                    onClick={onCreateVersion}
                    aria-label="Create snapshot"
                  >
                    <Icon icon={Plus} size="sm" weight="bold" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="ps-glass-subtle border-border/60 text-body-sm text-foreground"
                >
                  <span>Create snapshot</span>
                </TooltipContent>
              </Tooltip>
              {onCollapseDrawer ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="canvas"
                      size="icon-sm"
                      onClick={onCollapseDrawer}
                      aria-label="Collapse versions panel"
                    >
                      <Icon
                        icon={CaretLeft}
                        size="sm"
                        weight="bold"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="ps-glass-subtle border-border/60 text-body-sm text-foreground"
                  >
                    <span>Toggle versions ([)</span>
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </TooltipProvider>
      </div>
      {orderedVersions.length === 0 ? (
        <div className="text-label-12 text-muted flex flex-1 items-center justify-center">
          No versions yet
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-ps-2 overflow-y-auto px-ps-3 pb-ps-3">
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
