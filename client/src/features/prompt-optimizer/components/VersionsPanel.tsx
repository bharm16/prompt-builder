import React, { memo } from 'react';
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

export const VersionsPanel = memo(function VersionsPanel({
  versions,
  selectedVersionId,
  onSelectVersion,
  onCreateVersion,
  isCompact = false,
  onExpandDrawer,
  onCollapseDrawer,
  layout = 'vertical',
}: VersionsPanelProps): React.ReactElement {
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
  const horizontalScrollerRef = React.useRef<HTMLDivElement>(null);
  const [horizontalFadeState, setHorizontalFadeState] = React.useState<{
    showLeft: boolean;
    showRight: boolean;
    isScrollable: boolean;
  }>({ showLeft: false, showRight: false, isScrollable: false });

  React.useEffect(() => {
    if (layout !== 'horizontal' || isCompact) return;
    const scroller = horizontalScrollerRef.current;
    if (!scroller) return;

    const updateFadeState = (): void => {
      const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
      const isScrollable = maxScrollLeft > 1;
      const showLeft = isScrollable && scroller.scrollLeft > 1;
      const showRight = isScrollable && scroller.scrollLeft < maxScrollLeft - 1;
      setHorizontalFadeState({ showLeft, showRight, isScrollable });
    };

    updateFadeState();
    scroller.addEventListener('scroll', updateFadeState, { passive: true });
    window.addEventListener('resize', updateFadeState);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateFadeState())
        : null;
    resizeObserver?.observe(scroller);

    return () => {
      scroller.removeEventListener('scroll', updateFadeState);
      window.removeEventListener('resize', updateFadeState);
      resizeObserver?.disconnect();
    };
  }, [isCompact, layout, orderedVersions.length]);

  // Horizontal layout (bottom drawer)
  if (layout === 'horizontal') {
    const compactLabel = `${versionCount} version${versionCount === 1 ? '' : 's'}`;
    const isExpanded = !isCompact;
    const chevronClass = `ps-transition-transform${isExpanded ? '' : ' rotate-180'}`;

    // Compact horizontal bar - Premium cinematic style
    if (isCompact) {
      return (
        <div
          className={cn(
            'flex h-ps-9 w-full items-center justify-between',
            'px-ps-6',
            'bg-[rgb(30,31,37)]',
            'border border-[rgb(41,44,50)]',
            'rounded-lg',
            'shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
          )}
          aria-label="Versions"
        >
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            onClick={onExpandDrawer}
            title="Expand versions"
            aria-label="Expand versions"
          >
            <Icon
              icon={List}
              size="sm"
              weight="bold"
              aria-hidden="true"
              className="text-[rgb(170,174,187)]"
            />
            <span className="text-[12px] font-semibold text-[rgb(235,236,239)]">
              Versions
            </span>
            <span
              className={cn(
                'ml-2 inline-flex items-center justify-center',
                'rounded-[10px] bg-[rgb(44,48,55)]',
                'px-2 py-[2px]',
                'text-[11px] font-medium text-[rgb(170,174,187)]'
              )}
              aria-label={compactLabel}
              title={compactLabel}
            >
              {versionCount}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-md',
                'text-[rgb(170,174,187)]',
                'hover:bg-[rgb(44,48,55)] hover:text-[rgb(235,236,239)]',
                'transition-colors'
              )}
              onClick={(event) => {
                event.stopPropagation();
                onCreateVersion();
              }}
              aria-label="Create snapshot"
              title="Create snapshot"
            >
              <Icon icon={Plus} size="sm" weight="bold" aria-hidden="true" />
            </button>

            <button
              type="button"
              className={cn(
                'group inline-flex h-8 w-8 items-center justify-center rounded-md',
                'text-[rgb(170,174,187)]',
                'hover:bg-[rgb(44,48,55)] hover:text-[rgb(235,236,239)]',
                'transition-colors'
              )}
              onClick={onExpandDrawer}
              aria-label="Expand versions"
              title="Expand versions"
            >
              <Icon
                icon={CaretDown}
                size="sm"
                weight="bold"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:rotate-180"
              />
            </button>
          </div>
        </div>
      );
    }

    // Expanded horizontal filmstrip
    return (
      <aside className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-[rgb(41,44,50)] bg-[rgb(30,31,37)] shadow-[0_7px_21px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <TooltipProvider delayDuration={120}>
          <div className="flex h-ps-9 items-center justify-between gap-3 px-ps-6">
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
            <div
              className={cn(
                'pointer-events-none absolute left-0 top-0 z-10 h-full w-6 bg-gradient-to-r from-[rgb(30,31,37)] to-transparent transition-opacity',
                horizontalFadeState.showLeft ? 'opacity-100' : 'opacity-0'
              )}
              aria-hidden="true"
            />
            <div
              ref={horizontalScrollerRef}
              className={cn(
                'ps-scrollbar-thin',
                'flex h-full items-stretch overflow-x-auto',
                'gap-3',
                'px-4 pt-3 pb-4',
                'snap-x snap-mandatory scroll-px-4'
              )}
            >
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
            <div
              className={cn(
                'pointer-events-none absolute right-0 top-0 z-10 h-full w-6 bg-gradient-to-l from-[rgb(30,31,37)] to-transparent transition-opacity',
                horizontalFadeState.showRight ? 'opacity-100' : 'opacity-0'
              )}
              aria-hidden="true"
            />
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
      <div className="px-ps-6 pb-ps-3 pt-ps-4">
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
});

VersionsPanel.displayName = 'VersionsPanel';
