import React from 'react';
import {
  ArrowRight as LogIn,
  ChevronLeft as PanelLeft,
  Search,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { HistoryEmptyState } from '@components/EmptyState';
import { useToast } from '@components/Toast';
import { modKey } from '@components/KeyboardShortcuts/shortcuts.config';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@promptstudio/system/components/ui/dialog';
import { Input } from '@promptstudio/system/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@promptstudio/system/components/ui/tooltip';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { User, PromptHistoryEntry } from '@hooks/types';
import { cn } from '@/utils/cn';
import { HistoryItem } from './components/HistoryItem';
import { AuthMenu } from './components/AuthMenu';
import { HistoryThumbnail } from './components/HistoryThumbnail';
import { useHistoryAuthActions } from './hooks/useHistoryAuthActions';
import { formatRelativeOrDate } from './utils/historyDates';
import { extractDisambiguator, normalizeTitle, resolveEntryTitle } from './utils/historyTitles';
import { formatModelLabel, normalizeProcessingLabel, resolveEntryStage } from './utils/historyStages';
import { hasVideoArtifact, isRecentEntry, resolveHistoryThumbnail } from './utils/historyMedia';

export interface HistorySidebarProps {
  showHistory: boolean; // true = expanded, false = collapsed
  setShowHistory: (show: boolean) => void;
  user: User | null;
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFromHistory: (entry: PromptHistoryEntry) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
  onDuplicate?: (entry: PromptHistoryEntry) => void;
  onRename?: (entry: PromptHistoryEntry, title: string) => void;
  currentPromptUuid?: string | null;
  currentPromptDocId?: string | null;
  activeTitle: string;
  activeStatusLabel: string;
  activeModelLabel: string;
  activeDurationS: number | null;
}

const INITIAL_HISTORY_LIMIT = 5;
const COLLAPSED_TIMELINE_MAX = 5;

/**
 * History sidebar component with collapsed/expanded states
 */
export function HistorySidebar({
  showHistory,
  setShowHistory,
  user,
  history,
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onCreateNew,
  onLoadFromHistory,
  onDelete,
  onDuplicate,
  onRename,
  currentPromptUuid,
  currentPromptDocId,
  activeStatusLabel,
  activeModelLabel,
}: HistorySidebarProps): React.ReactElement {
  const debug = useDebugLogger('HistorySidebar', {
    historyCount: history.length,
    isExpanded: showHistory,
    isAuthenticated: !!user,
  });
  const toast = useToast();
  const { handleSignIn, handleSignOut } = useHistoryAuthActions(debug, toast);
  const [showAllHistory, setShowAllHistory] = React.useState<boolean>(false);
  const hoverExpandedRef = React.useRef<boolean>(false);
  const [hoveredEntryKey, setHoveredEntryKey] = React.useState<string | null>(
    null
  );
  const [focusedEntryKey, setFocusedEntryKey] = React.useState<string | null>(
    null
  );
  const [renameEntry, setRenameEntry] =
    React.useState<PromptHistoryEntry | null>(null);
  const [renameValue, setRenameValue] = React.useState<string>('');
  const [filterState, setFilterState] = React.useState<{
    videosOnly: boolean;
    recentOnly: boolean;
  }>({
    videosOnly: false,
    recentOnly: false,
  });
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (renameEntry) {
      setRenameValue(resolveEntryTitle(renameEntry));
    }
  }, [renameEntry]);

  // Determine which history items to display
  const filteredByChips = React.useMemo(() => {
    return filteredHistory.filter((entry) => {
      if (filterState.videosOnly && !hasVideoArtifact(entry)) {
        return false;
      }
      if (filterState.recentOnly && !isRecentEntry(entry)) {
        return false;
      }
      return true;
    });
  }, [filteredHistory, filterState]);

  const displayedHistory = showAllHistory
    ? filteredByChips
    : filteredByChips.slice(0, INITIAL_HISTORY_LIMIT);
  const hasActiveFilters = filterState.videosOnly || filterState.recentOnly;

  const handleCopyPrompt = React.useCallback(
    async (entry: PromptHistoryEntry): Promise<void> => {
      const payload = entry.output?.trim() ? entry.output : entry.input;
      if (!payload.trim()) {
        toast.warning('Nothing to copy yet.');
        return;
      }
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        toast.error('Clipboard unavailable.');
        return;
      }
      try {
        await navigator.clipboard.writeText(payload);
        toast.success('Prompt copied to clipboard');
      } catch {
        toast.error('Failed to copy prompt');
      }
    },
    [toast]
  );

  const handleOpenInNewTab = React.useCallback(
    (entry: PromptHistoryEntry): void => {
      if (!entry.uuid) {
        toast.warning('This prompt is not available in a new tab yet.');
        return;
      }
      window.open(`/prompt/${entry.uuid}`, '_blank', 'noopener,noreferrer');
    },
    [toast]
  );

  const handleRenameRequest = React.useCallback((entry: PromptHistoryEntry) => {
    setRenameEntry(entry);
  }, []);

  const handleRenameSubmit = React.useCallback(() => {
    if (!renameEntry) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.warning('Title cannot be empty.');
      return;
    }
    onRename?.(renameEntry, trimmed);
    setRenameEntry(null);
  }, [renameEntry, renameValue, onRename, toast]);

  const isCollapsed = !showHistory;

  const handleSidebarMouseEnter = React.useCallback(() => {
    if (!isCollapsed) return;
    hoverExpandedRef.current = true;
    setShowHistory(true);
  }, [isCollapsed, setShowHistory]);

  const handleSidebarMouseLeave = React.useCallback(() => {
    setHoveredEntryKey(null);
    if (!hoverExpandedRef.current) return;
    hoverExpandedRef.current = false;
    setShowHistory(false);
  }, [setShowHistory]);

  const promptRows = React.useMemo(() => {
    const baseTitles = displayedHistory.map((entry) =>
      normalizeTitle(resolveEntryTitle(entry))
    );
    const counts = new Map<string, number>();
    baseTitles.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    const seen = new Map<string, number>();

    return displayedHistory.map((entry, index) => {
      const stage = resolveEntryStage(entry);
      const baseTitle = baseTitles[index] ?? 'Untitled';
      const hasDupes = (counts.get(baseTitle) ?? 0) > 1;
      const nextSeen = (seen.get(baseTitle) ?? 0) + 1;
      seen.set(baseTitle, nextSeen);

      const isSelected = Boolean(
        (currentPromptUuid && entry.uuid === currentPromptUuid) ||
          (currentPromptDocId && entry.id === currentPromptDocId)
      );

      const dateLabel = formatRelativeOrDate(entry.timestamp);
      const modelLabel =
        formatModelLabel(
          typeof entry.targetModel === 'string' ? entry.targetModel : null
        ) ?? (isSelected ? formatModelLabel(activeModelLabel) : null);

      const normalizedActiveProcessing =
        activeStatusLabel === 'Optimizing' ? 'Refining' : activeStatusLabel;
      const processingLabel = isSelected
        ? normalizeProcessingLabel(normalizedActiveProcessing)
        : null;
      const effectiveProcessingLabel =
        isSelected &&
        (activeStatusLabel === 'Refining' || activeStatusLabel === 'Optimizing')
          ? processingLabel
          : null;

      // Keep list meta compact: time only (duration/model are redundant in list context).
      const meta = dateLabel;

      const disambiguator =
        extractDisambiguator(entry.input) ??
        (() => {
          const model =
            formatModelLabel(
              typeof entry.targetModel === 'string' ? entry.targetModel : null
            ) ?? modelLabel;
          if (!model) return null;
          return nextSeen === 1 ? model : `alt ${nextSeen}`;
        })() ??
        `alt ${nextSeen}`;

      const title = hasDupes ? `${baseTitle} - ${disambiguator}` : baseTitle;

      const key = (entry.id ||
        entry.uuid ||
        `${entry.timestamp ?? ''}-${title}`) as string;

      return {
        entry,
        stage,
        title,
        meta,
        isSelected,
        processingLabel: effectiveProcessingLabel,
        key,
        thumbnailUrl: resolveHistoryThumbnail(entry),
      };
    });
  }, [
    displayedHistory,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
  ]);

  const collapsedTimeline = React.useMemo(() => {
    const entries = filteredByChips.slice(0, COLLAPSED_TIMELINE_MAX);
    const overflow = Math.max(
      0,
      filteredByChips.length - COLLAPSED_TIMELINE_MAX
    );
    return { entries, overflow };
  }, [filteredByChips]);

  const rowByKey = React.useMemo(() => {
    return new Map(promptRows.map((row) => [row.key, row]));
  }, [promptRows]);

  React.useEffect(() => {
    if (!showHistory) {
      setFocusedEntryKey(null);
    }
  }, [showHistory, filteredByChips.length]);

  React.useEffect(() => {
    if (!showHistory || renameEntry) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (event.key === '/') {
        if (isTypingTarget) return;
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isTypingTarget) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (promptRows.length === 0) return;

        const selectedKey =
          promptRows.find((row) => row.isSelected)?.key ?? null;
        const currentKey =
          focusedEntryKey ?? selectedKey ?? promptRows[0]?.key ?? null;
        const currentIndex = currentKey
          ? promptRows.findIndex((row) => row.key === currentKey)
          : 0;
        const safeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          event.key === 'ArrowDown'
            ? Math.min(promptRows.length - 1, safeIndex + 1)
            : Math.max(0, safeIndex - 1);
        const nextKey = promptRows[nextIndex]?.key ?? null;

        if (nextKey) {
          setFocusedEntryKey(nextKey);
          const targetNode = document.querySelector(
            `[data-history-index="${nextIndex}"]`
          );
          if (targetNode instanceof HTMLElement) {
            targetNode.scrollIntoView({ block: 'nearest' });
          }
        }
      }

      if (event.key === 'Enter') {
        const selectedKey =
          focusedEntryKey ??
          promptRows.find((row) => row.isSelected)?.key ??
          null;
        if (!selectedKey) return;
        const row = rowByKey.get(selectedKey);
        if (row) {
          onLoadFromHistory(row.entry);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showHistory,
    renameEntry,
    promptRows,
    focusedEntryKey,
    rowByKey,
    onLoadFromHistory,
  ]);

  return (
    <aside
      id="history-sidebar"
      className={cn(
        'bg-sidebar ps-sidebar-edge duration-slow flex h-full min-h-0 flex-none flex-col overflow-hidden p-ps-4 transition-all',
        // Enforce a hard cap so the sidebar can't expand due to missing/overridden token CSS.
        isCollapsed ? 'w-[60px]' : 'w-sidebar max-w-sidebar basis-sidebar min-w-0'
      )}
      aria-label="Prompt history"
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {isCollapsed ? (
        <div className="gap-ps-2 ps-animate-fade-in flex h-full flex-col items-center">
          <Button
            type="button"
            onClick={() => {
              hoverExpandedRef.current = false;
              setShowHistory(true);
            }}
            variant="ghost"
            size="icon"
            className="h-ps-8 w-ps-8 rounded-[6px] bg-[rgb(44,48,55)] text-muted ps-transition hover:bg-[rgb(36,42,56)] hover:text-foreground"
            aria-label="Expand sidebar"
            title="Vidra"
          >
            <span className="text-body-sm text-foreground font-semibold">
              V
            </span>
          </Button>

          <div className="ps-divider-fade" aria-hidden="true" />

          <TooltipProvider delayDuration={120}>
            <div className="gap-ps-2 relative flex flex-col items-center">
              {collapsedTimeline.entries.map((entry) => {
                const key = (entry.id || entry.uuid) as string | undefined;
                const isSelected = Boolean(
                  (currentPromptUuid && entry.uuid === currentPromptUuid) ||
                    (currentPromptDocId && entry.id === currentPromptDocId)
                );
                const title = resolveEntryTitle(entry);
                return (
                  <Tooltip
                    key={
                      key ??
                      `${entry.timestamp ?? ''}-${entry.input.slice(0, 8)}`
                    }
                  >
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="ps-thumb-trigger text-faint flex flex-col items-center gap-1"
                        aria-label={`Prompt: ${title}`}
                        onMouseEnter={() => setHoveredEntryKey(key ?? null)}
                        onMouseLeave={() => setHoveredEntryKey(null)}
                        onClick={() => {
                          hoverExpandedRef.current = false;
                          setShowHistory(true);
                          onLoadFromHistory(entry);
                        }}
                      >
                        <HistoryThumbnail
                          src={resolveHistoryThumbnail(entry)}
                          label={title}
                          size="sm"
                          variant="muted"
                          isActive={isSelected}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      className={cn(
                        'text-body-sm text-foreground',
                        'rounded-lg border border-[rgb(67,70,81)] bg-[rgb(24,25,28)]',
                        'shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
                      )}
                    >
                      {title}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {collapsedTimeline.overflow > 0 && (
                <div className="ps-rail-fade" aria-hidden="true" />
              )}
            </div>
          </TooltipProvider>

          <div className="ps-divider-fade" aria-hidden="true" />

          <Button
            type="button"
            onClick={onCreateNew}
            variant="ghost"
            size="icon"
            className="h-ps-8 w-ps-8 rounded-[6px] bg-[rgb(44,48,55)] text-muted ps-transition hover:bg-[rgb(36,42,56)] hover:text-foreground"
            aria-label="New prompt"
            title="New prompt"
          >
            <span>+</span>
          </Button>

          <div className="ps-divider-fade" aria-hidden="true" />

          <div className="mt-auto">
            {!user ? (
              <Button
                type="button"
                onClick={handleSignIn}
                variant="ghost"
                size="icon"
                className="h-ps-8 w-ps-8 rounded-[6px] bg-[rgb(44,48,55)] text-muted ps-transition hover:bg-[rgb(36,42,56)] hover:text-foreground"
                aria-label="Sign in"
                title="Sign in"
              >
                <LogIn size={18} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  hoverExpandedRef.current = false;
                  setShowHistory(true);
                }}
                variant="ghost"
                size="icon"
                className="h-ps-8 w-ps-8 rounded-[6px] bg-[rgb(44,48,55)] text-muted ps-transition hover:bg-[rgb(36,42,56)] hover:text-foreground"
                aria-label="User menu"
                title={
                  typeof user.displayName === 'string'
                    ? user.displayName
                    : 'User'
                }
              >
                {typeof user.photoURL === 'string' && user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <UserIcon size={18} />
                )}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="ps-animate-fade-in flex h-full flex-col">
          <header className="flex h-12 items-center justify-between px-4">
            <h1 className="text-[16px] font-semibold text-foreground">
              Vidra
            </h1>
            <Button
              onClick={() => {
                hoverExpandedRef.current = false;
                setShowHistory(false);
              }}
              variant="ghost"
              size="icon"
              aria-label="Collapse sidebar"
              className="h-7 w-7 rounded-md bg-[rgb(44,48,55)] text-muted transition-colors hover:bg-[rgb(36,42,56)] hover:text-foreground"
            >
              <PanelLeft size={18} />
            </Button>
          </header>

          <div
            className="mx-4 my-3 h-px bg-[rgb(41,44,50)]"
            aria-hidden="true"
          />

          <section className="flex min-h-0 flex-1 flex-col gap-ps-4 px-4 py-ps-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-[rgb(107,114,128)]">
                <Sparkles
                  className="h-3.5 w-3.5 text-[rgb(107,114,128)]"
                  aria-hidden="true"
                />
                <h2>Prompts</h2>
              </div>
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-md bg-[rgb(44,48,55)] px-[10px] py-1 text-[12px] font-medium text-[rgb(198,201,210)] shadow-none hover:bg-[rgb(36,42,56)] hover:text-foreground"
                      onClick={onCreateNew}
                      aria-label="New prompt"
                    >
                      + New
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    className={cn(
                      'text-body-sm text-foreground',
                      'rounded-lg border border-[rgb(67,70,81)] bg-[rgb(24,25,28)]',
                      'shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
                    )}
                  >
                    New prompt ({modKey === 'Cmd' ? '⌘N' : 'Ctrl+N'})
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="ps-focus-glow relative rounded-lg">
              <Search
                className="left-ps-3 text-faint absolute top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search..."
                aria-label="Search prompts"
                className="h-9 rounded-lg border border-[rgb(41,44,50)] bg-[rgb(30,31,37)] pl-9 pr-ps-3 text-body-sm text-foreground placeholder:text-faint focus-visible:border-[rgb(59,130,246)] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="gap-ps-2 flex flex-wrap items-center">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn(
                  'h-7 rounded-md border border-[rgb(44,48,55)] bg-[rgb(30,31,37)] px-[10px] py-1 text-[12px] font-medium text-[rgb(198,201,210)] transition-colors hover:bg-[rgb(39,42,55)] hover:text-foreground',
                  filterState.videosOnly &&
                    'border-[rgb(67,70,81)] bg-[rgb(44,48,55)] text-foreground'
                )}
                onClick={() =>
                  setFilterState((prev) => ({
                    ...prev,
                    videosOnly: !prev.videosOnly,
                  }))
                }
              >
                Videos only
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn(
                  'h-7 rounded-md border border-[rgb(44,48,55)] bg-[rgb(30,31,37)] px-[10px] py-1 text-[12px] font-medium text-[rgb(198,201,210)] transition-colors hover:bg-[rgb(39,42,55)] hover:text-foreground',
                  filterState.recentOnly &&
                    'border-[rgb(67,70,81)] bg-[rgb(44,48,55)] text-foreground'
                )}
                onClick={() =>
                  setFilterState((prev) => ({
                    ...prev,
                    recentOnly: !prev.recentOnly,
                  }))
                }
              >
                Last 7 days
              </Button>
            </div>

            {isLoadingHistory ? (
              <div className="text-label-sm text-faint flex flex-col items-center gap-2 py-6 text-center">
                <div className="ps-spinner-sm" />
                <p>Loading...</p>
              </div>
            ) : filteredByChips.length === 0 ? (
              searchQuery ? (
                <div className="text-label-sm text-faint py-6 text-center">
                  <p>No results for &quot;{searchQuery}&quot;.</p>
                </div>
              ) : hasActiveFilters ? (
                <div className="text-label-sm text-faint py-6 text-center">
                  <p>No prompts match these filters.</p>
                </div>
              ) : (
                <HistoryEmptyState onCreateNew={onCreateNew} />
              )
            ) : (
              <>
                <nav
                  aria-label="Prompts list"
                  className="ps-scrollbar-thin flex-1 overflow-y-auto"
                >
                  <ul className="gap-ps-2 flex flex-col">
                    {promptRows.map(
                      (
                        {
                          entry,
                          title,
                          meta,
                          stage,
                          isSelected,
                          processingLabel,
                          key,
                          thumbnailUrl,
                        },
                        index
                      ) => {
                        const externalHover = Boolean(
                          (hoveredEntryKey &&
                            (entry.id === hoveredEntryKey ||
                              entry.uuid === hoveredEntryKey ||
                              key === hoveredEntryKey)) ||
                            (focusedEntryKey &&
                              (entry.id === focusedEntryKey ||
                                entry.uuid === focusedEntryKey ||
                                key === focusedEntryKey))
                        );
                        return (
                          <HistoryItem
                            key={key}
                            entry={entry}
                            onLoad={onLoadFromHistory}
                            onDelete={onDelete}
                            isSelected={isSelected}
                            isExternallyHovered={externalHover}
                            title={title}
                            meta={meta}
                            stage={stage}
                            processingLabel={processingLabel}
                            thumbnailUrl={thumbnailUrl}
                            onDuplicate={onDuplicate}
                            onRename={handleRenameRequest}
                            onCopyPrompt={handleCopyPrompt}
                            onOpenInNewTab={handleOpenInNewTab}
                            dataIndex={index}
                          />
                        );
                      }
                    )}
                  </ul>
                </nav>
                {filteredByChips.length > INITIAL_HISTORY_LIMIT && (
                  <Button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    variant="ghost"
                    size="sm"
                    className="text-label-sm text-faint w-full justify-start"
                  >
                    {showAllHistory ? 'See less' : 'See more...'}
                  </Button>
                )}
              </>
            )}
          </section>

          <footer className="mt-auto flex h-16 items-center border-t border-[rgb(41,44,50)] px-4 py-3">
            <AuthMenu
              user={user}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </footer>
        </div>
      )}

      <Dialog
        open={Boolean(renameEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameEntry(null);
          }
        }}
      >
        <DialogContent className="ps-card-glass p-ps-5 max-w-sm rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-body-lg text-foreground">
              Rename prompt
            </DialogTitle>
            <DialogDescription className="text-body-sm text-muted">
              Give this prompt a short, memorable title.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Prompt title"
            className="mt-ps-2"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleRenameSubmit();
              }
            }}
          />
          <DialogFooter className="mt-ps-4 gap-ps-2 flex sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenameEntry(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
