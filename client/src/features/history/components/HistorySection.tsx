/**
 * Core history list functionality.
 * Extracted from HistorySidebar to allow embedding in different shells.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Search } from 'lucide-react';
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
import type { PromptHistoryEntry } from '@hooks/types';
import { cn } from '@utils/cn';
import type { HistorySectionProps } from '@components/navigation/AppShell/types';
import { HistoryItem } from './HistoryItem';
import { formatRelativeOrDate } from '../utils/historyDates';
import {
  extractDisambiguator,
  normalizeTitle,
  resolveEntryTitle,
} from '../utils/historyTitles';
import {
  formatModelLabel,
  normalizeProcessingLabel,
  resolveEntryStage,
} from '../utils/historyStages';
import {
  hasVideoArtifact,
  isRecentEntry,
  resolveHistoryThumbnail,
} from '../utils/historyMedia';

const INITIAL_HISTORY_LIMIT = 5;

export function HistorySection({
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onLoadFromHistory,
  onCreateNew,
  onDelete,
  onDuplicate,
  onRename,
  currentPromptUuid,
  currentPromptDocId,
  activeStatusLabel,
  activeModelLabel,
}: HistorySectionProps): ReactElement {
  const toast = useToast();
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);
  const [focusedEntryKey, setFocusedEntryKey] = useState<string | null>(null);
  const [renameEntry, setRenameEntry] = useState<PromptHistoryEntry | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [filterState, setFilterState] = useState<{
    videosOnly: boolean;
    recentOnly: boolean;
  }>({
    videosOnly: false,
    recentOnly: false,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renameEntry) {
      setRenameValue(resolveEntryTitle(renameEntry));
    }
  }, [renameEntry]);

  const filteredByChips = useMemo(() => {
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

  const handleCopyPrompt = useCallback(
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

  const handleOpenInNewTab = useCallback(
    (entry: PromptHistoryEntry): void => {
      if (!entry.uuid) {
        toast.warning('This prompt is not available in a new tab yet.');
        return;
      }
      window.open(`/prompt/${entry.uuid}`, '_blank', 'noopener,noreferrer');
    },
    [toast]
  );

  const handleRenameRequest = useCallback((entry: PromptHistoryEntry): void => {
    setRenameEntry(entry);
  }, []);

  const handleRenameSubmit = useCallback((): void => {
    if (!renameEntry) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.warning('Title cannot be empty.');
      return;
    }
    onRename?.(renameEntry, trimmed);
    setRenameEntry(null);
  }, [renameEntry, renameValue, onRename, toast]);

  const promptRows = useMemo(() => {
    const baseTitles = displayedHistory.map((entry) =>
      normalizeTitle(resolveEntryTitle(entry))
    );
    const counts = new Map<string, number>();
    baseTitles.forEach((title) => counts.set(title, (counts.get(title) ?? 0) + 1));
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
      const fallbackModelLabel =
        isSelected && typeof activeModelLabel === 'string'
          ? formatModelLabel(activeModelLabel)
          : null;
      const modelLabel =
        formatModelLabel(typeof entry.targetModel === 'string' ? entry.targetModel : null) ??
        fallbackModelLabel;

      const normalizedActiveStatus =
        typeof activeStatusLabel === 'string' && activeStatusLabel.trim()
          ? activeStatusLabel
          : '';
      const normalizedProcessingStatus =
        normalizedActiveStatus === 'Optimizing' ? 'Refining' : normalizedActiveStatus;
      const processingLabel =
        isSelected && normalizedProcessingStatus
          ? normalizeProcessingLabel(normalizedProcessingStatus)
          : null;
      const effectiveProcessingLabel =
        isSelected &&
        (normalizedActiveStatus === 'Refining' || normalizedActiveStatus === 'Optimizing')
          ? processingLabel
          : null;

      const meta = dateLabel;

      const disambiguator =
        extractDisambiguator(entry.input) ??
        (() => {
          const model =
            formatModelLabel(typeof entry.targetModel === 'string' ? entry.targetModel : null) ??
            modelLabel;
          if (!model) return null;
          return nextSeen === 1 ? model : `alt ${nextSeen}`;
        })() ??
        `alt ${nextSeen}`;

      const title = hasDupes ? `${baseTitle} - ${disambiguator}` : baseTitle;
      const key = entry.id ?? entry.uuid ?? `${entry.timestamp ?? ''}-${title}`;

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

  const rowByKey = useMemo(() => {
    return new Map(promptRows.map((row) => [row.key, row]));
  }, [promptRows]);

  useEffect(() => {
    setFocusedEntryKey(null);
  }, [filteredByChips.length]);

  useEffect(() => {
    if (renameEntry) return;

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

        const selectedKey = promptRows.find((row) => row.isSelected)?.key ?? null;
        const currentKey = focusedEntryKey ?? selectedKey ?? promptRows[0]?.key ?? null;
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
          focusedEntryKey ?? promptRows.find((row) => row.isSelected)?.key ?? null;
        if (!selectedKey) return;
        const row = rowByKey.get(selectedKey);
        if (row) {
          onLoadFromHistory(row.entry);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [renameEntry, promptRows, focusedEntryKey, rowByKey, onLoadFromHistory]);

  const duplicateProps = typeof onDuplicate === 'function' ? { onDuplicate } : {};
  const renameProps =
    typeof onRename === 'function' ? { onRename: handleRenameRequest } : {};

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col gap-ps-4 px-4 py-ps-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-[rgb(107,114,128)]">
            <h2>Sessions</h2>
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
                New prompt ({modKey === 'Cmd' ? 'Cmd+N' : 'Ctrl+N'})
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
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search..."
            aria-label="Search sessions"
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
              aria-label="Sessions list"
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
                    const externalHover =
                      focusedEntryKey !== null &&
                      (entry.id === focusedEntryKey ||
                        entry.uuid === focusedEntryKey ||
                        key === focusedEntryKey);
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
                        onCopyPrompt={handleCopyPrompt}
                        onOpenInNewTab={handleOpenInNewTab}
                        dataIndex={index}
                        {...duplicateProps}
                        {...renameProps}
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

      <Dialog
        open={Boolean(renameEntry)}
        onOpenChange={(open: boolean) => {
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
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setRenameValue(event.target.value)
            }
            placeholder="Prompt title"
            className="mt-ps-2"
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
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
    </>
  );
}
