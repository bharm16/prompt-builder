import React from 'react';
import {
  ArrowRight as LogIn,
  ChevronLeft as PanelLeft,
  Search,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { HistoryEmptyState } from '@components/EmptyState';
import { useToast } from '@components/Toast';
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
import { modKey } from '@components/KeyboardShortcuts/shortcuts.config';
import { HistoryItem } from './components/HistoryItem';
import { AuthMenu } from './components/AuthMenu';
import { HistoryThumbnail } from './components/HistoryThumbnail';
import { cn } from '@/utils/cn';

type PromptRowStage = 'draft' | 'optimized' | 'generated' | 'error';

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

function formatShortDate(iso: string | undefined): string {
  if (!iso) return 'No date';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return 'No date';
  const now = new Date();
  const sameYear = t.getFullYear() === now.getFullYear();
  return t.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function resolveEntryTitle(entry: PromptHistoryEntry): string {
  const storedTitle =
    typeof entry.title === 'string' ? normalizeTitle(entry.title) : '';
  if (storedTitle) return storedTitle;
  return deriveBaseTitle(entry.input);
}

function condensedTitle(value: string, maxChars: number = 30): string {
  const normalized = normalizeTitle(value);
  if (!normalized) return 'Untitled';
  return normalized.length > maxChars
    ? `${normalized.slice(0, maxChars).trim()}...`
    : normalized;
}

function resolveEntryStage(entry: PromptHistoryEntry): PromptRowStage {
  const hasInput =
    typeof entry.input === 'string' && entry.input.trim().length > 0;
  const hasOutput =
    typeof entry.output === 'string' && entry.output.trim().length > 0;
  if (!hasInput && !hasOutput) return 'draft';
  if (hasInput && !hasOutput) return 'draft';
  if (!hasOutput) return 'error';
  if (entry.highlightCache) return 'generated';
  return 'optimized';
}

function formatRelativeOrDate(iso: string | undefined): string {
  if (!iso) return 'No date';
  const t = new Date(iso);
  const ms = t.getTime();
  if (Number.isNaN(ms)) return 'No date';
  const diffMs = Date.now() - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 0) return formatShortDate(iso);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(iso);
}

function extractDurationS(
  entry: PromptHistoryEntry,
  selectedFallback: number | null
): number | null {
  const fromEntry = (
    entry.generationParams as Record<string, unknown> | null | undefined
  )?.duration_s;
  if (typeof fromEntry === 'number' && Number.isFinite(fromEntry))
    return fromEntry;
  if (
    typeof fromEntry === 'string' &&
    fromEntry.trim() &&
    !Number.isNaN(Number(fromEntry))
  )
    return Number(fromEntry);
  if (typeof selectedFallback === 'number' && Number.isFinite(selectedFallback))
    return selectedFallback;
  return null;
}

function toTitleToken(token: string): string {
  if (!token) return token;
  if (token.toLowerCase() === 'tv') return 'TV';
  if (token.toUpperCase() === token && token.length <= 4) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function deriveBaseTitle(input: string): string {
  const normalized = input.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Untitled';

  const rawTokens = normalized.split(' ');
  const stop = new Set([
    'a',
    'an',
    'the',
    'this',
    'that',
    'these',
    'those',
    'some',
    'my',
    'your',
    'our',
    'their',
  ]);

  let start = 0;
  while (
    start < rawTokens.length &&
    stop.has(rawTokens[start]?.toLowerCase() ?? '')
  )
    start += 1;

  const tokens = rawTokens.slice(start);
  if (tokens.length === 0) return 'Untitled';

  const first = tokens[0] ?? '';
  const second = tokens[1] ?? '';
  const third = tokens[2] ?? '';
  const secondLower = second.toLowerCase();

  const nounFollowers = new Set([
    'chase',
    'battle',
    'portrait',
    'scene',
    'shot',
    'sequence',
    'close-up',
    'closeup',
  ]);
  const takeThird = secondLower.endsWith('ing') && third;
  const takeTwo = nounFollowers.has(secondLower) || Boolean(second);

  const chosen: string[] = [];
  chosen.push(first);
  if (takeTwo) chosen.push(second);
  if (takeThird) chosen.push(third);

  return chosen
    .filter(Boolean)
    .map((t) => toTitleToken(t))
    .join(' ')
    .trim();
}

function extractDisambiguator(input: string): string | null {
  const lower = input.toLowerCase();
  const priorities = [
    { key: 'night', label: 'night' },
    { key: 'day', label: 'day' },
    { key: 'handheld', label: 'handheld' },
    { key: 'wide', label: 'wide' },
    { key: 'close-up', label: 'close-up' },
    { key: 'closeup', label: 'close-up' },
    { key: 'aerial', label: 'aerial' },
    { key: 'cinematic', label: 'cinematic' },
    { key: 'noir', label: 'noir' },
  ] as const;

  for (const p of priorities) {
    if (lower.includes(p.key)) return p.label;
  }
  return null;
}

function formatModelLabel(
  targetModel: string | null | undefined
): string | null {
  if (!targetModel || !targetModel.trim()) return null;
  const normalized = targetModel.trim().replace(/\s+/g, ' ');
  const veoMatch = normalized.match(/(veo[-\s]?\d+(?:\.\d+)?)/i);
  if (veoMatch?.[1]) {
    return veoMatch[1].replace(/\s+/g, '-').toLowerCase();
  }
  if (normalized.length <= 14) return normalized;
  return normalized.split(' ')[0] ?? normalized;
}

function normalizeProcessingLabel(label: string): string | null {
  const raw = label.trim();
  if (!raw) return null;
  if (raw.endsWith('...')) return raw;
  return `${raw}...`;
}

function resolveHistoryThumbnail(entry: PromptHistoryEntry): string | null {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  for (let i = versions.length - 1; i >= 0; i -= 1) {
    const candidate = versions[i]?.preview?.imageUrl;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

function hasVideoArtifact(entry: PromptHistoryEntry): boolean {
  const versions = Array.isArray(entry.versions) ? entry.versions : [];
  return versions.some((version) => {
    const url = version?.video?.videoUrl;
    return typeof url === 'string' && url.trim().length > 0;
  });
}

function isRecentEntry(entry: PromptHistoryEntry, days: number = 7): boolean {
  if (!entry.timestamp) return false;
  const ms = Date.parse(entry.timestamp);
  if (Number.isNaN(ms)) return false;
  const diffMs = Date.now() - ms;
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

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
  activeTitle,
  activeStatusLabel,
  activeModelLabel,
  activeDurationS,
}: HistorySidebarProps): React.ReactElement {
  const debug = useDebugLogger('HistorySidebar', {
    historyCount: history.length,
    isExpanded: showHistory,
    isAuthenticated: !!user,
  });
  const toast = useToast();
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

  const handleSignIn = async (): Promise<void> => {
    debug.logAction('signIn');
    debug.startTimer('signIn');
    try {
      const authRepository = getAuthRepository();
      const signedInUser = await authRepository.signInWithGoogle();
      const displayName =
        typeof signedInUser.displayName === 'string'
          ? signedInUser.displayName
          : 'User';
      debug.endTimer('signIn', 'Sign in successful');
      toast.success(`Welcome, ${displayName}!`);
    } catch (error) {
      debug.endTimer('signIn');
      debug.logError('Sign in failed', error as Error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    debug.logAction('signOut');
    try {
      const authRepository = getAuthRepository();
      await authRepository.signOut();
      debug.logAction('signOutComplete');
      toast.success('Signed out successfully');
    } catch (error) {
      debug.logError('Sign out failed', error as Error);
      toast.error('Failed to sign out');
    }
  };

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

  const activeEntry = React.useMemo(() => {
    return (
      history.find(
        (item) => currentPromptUuid && item.uuid === currentPromptUuid
      ) ||
      history.find(
        (item) => currentPromptDocId && item.id === currentPromptDocId
      ) ||
      null
    );
  }, [history, currentPromptUuid, currentPromptDocId]);

  const activeThumbnailUrl = activeEntry
    ? resolveHistoryThumbnail(activeEntry)
    : null;
  const showActiveProgress =
    activeStatusLabel === 'Refining' || activeStatusLabel === 'Optimizing';
  const activeStatusTone =
    activeStatusLabel === 'Refining' || activeStatusLabel === 'Optimizing'
      ? 'warning'
      : activeStatusLabel === 'Draft'
        ? 'muted'
        : activeStatusLabel === 'Incomplete'
          ? 'error'
          : null;

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
      const durationS = extractDurationS(
        entry,
        isSelected ? activeDurationS : null
      );
      const durationLabel =
        typeof durationS === 'number' ? `${durationS}s` : null;
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

      const meta = [dateLabel, durationLabel, modelLabel]
        .filter(Boolean)
        .join(' | ');

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
    activeDurationS,
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
        'bg-sidebar ps-sidebar-edge duration-slow flex h-full min-h-0 flex-none flex-col overflow-hidden transition-all',
        // Enforce a hard cap so the sidebar can't expand due to missing/overridden token CSS.
        isCollapsed ? 'w-14' : 'w-sidebar max-w-sidebar basis-sidebar min-w-0'
      )}
      aria-label="Prompt history"
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {isCollapsed ? (
        <div className="gap-ps-4 py-ps-4 ps-animate-fade-in flex h-full flex-col items-center">
          <Button
            type="button"
            onClick={() => {
              hoverExpandedRef.current = false;
              setShowHistory(true);
            }}
            variant="ghost"
            size="icon"
            className="h-ps-8 w-ps-8 border-border bg-surface-2 text-muted ps-transition hover:border-border-strong rounded-lg border hover:-translate-y-px"
            aria-label="Expand sidebar"
            title="Vidra"
          >
            <span className="text-body-sm text-foreground font-semibold">
              V
            </span>
          </Button>

          <div className="ps-divider-fade" aria-hidden="true" />

          <TooltipProvider delayDuration={120}>
            <div className="gap-ps-2 py-ps-2 relative flex flex-col items-center">
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
                          size="md"
                          variant="muted"
                          isActive={isSelected}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="ps-glass-subtle border-border/60 text-body-sm text-foreground">
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
            className="h-ps-8 w-ps-8 border-border bg-surface-2 text-muted ps-transition hover:border-border-strong rounded-lg border hover:-translate-y-px"
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
                className="h-ps-8 w-ps-8 border-border bg-surface-2 text-muted ps-transition hover:border-border-strong rounded-lg border hover:-translate-y-px"
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
                className="h-ps-8 w-ps-8 border-border bg-surface-2 text-muted ps-transition hover:border-border-strong rounded-lg border hover:-translate-y-px"
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
          <header className="px-ps-5 py-ps-6">
            <div className="mb-ps-4 flex items-center justify-between">
              <h1 className="text-h3 text-foreground font-bold tracking-tight">
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
                className="border-border bg-surface-2 text-muted ps-transition-colors hover:bg-surface-3 hover:text-foreground h-9 w-9 rounded-lg border"
              >
                <PanelLeft size={20} />
              </Button>
            </div>
            <div className="ps-divider-fade" aria-hidden="true" />
          </header>

          <section
            className="mt-ps-5 px-ps-5 pb-ps-5"
            aria-label="Active prompt"
          >
            <div className="gap-ps-2 text-label text-faint flex items-center uppercase tracking-widest">
              <span>Active Prompt</span>
              <span className="ps-divider-fade flex-1" aria-hidden="true" />
            </div>
            <div className="mt-ps-4 ps-card-glass p-ps-3 rounded-lg">
              <div className="gap-ps-3 flex items-start">
                <div className="ps-thumb-trigger">
                  <HistoryThumbnail
                    src={activeThumbnailUrl}
                    label={activeTitle}
                    size="lg"
                    variant="muted"
                    isActive={showActiveProgress}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="ps-line-clamp-2 text-body text-foreground font-semibold"
                    title={activeTitle}
                  >
                    {activeTitle}
                  </div>
                  <div className="mt-ps-2 gap-ps-2 text-label-sm text-muted flex flex-wrap items-center">
                    {activeStatusTone ? (
                      <span
                        className={cn(
                          'px-ps-2 text-label-sm rounded-full border py-0.5',
                          activeStatusTone === 'warning' &&
                            'border-warning/40 bg-warning/10 text-warning',
                          activeStatusTone === 'error' &&
                            'border-error/40 bg-error/10 text-error',
                          activeStatusTone === 'muted' &&
                            'border-border bg-surface-2 text-muted'
                        )}
                      >
                        {activeStatusLabel}
                      </span>
                    ) : null}
                    <span className="border-border bg-surface-2 px-ps-2 text-label-sm text-muted rounded-full border py-0.5">
                      {activeModelLabel}
                    </span>
                    {typeof activeDurationS === 'number' ? (
                      <span className="border-border bg-surface-2 px-ps-2 text-label-sm text-muted rounded-full border py-0.5">
                        {activeDurationS}s
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {showActiveProgress && (
                <div className="mt-ps-3 bg-surface-3 h-1 w-full overflow-hidden rounded-full">
                  <div className="ps-shimmer h-full w-1/2" aria-hidden="true" />
                </div>
              )}
            </div>
          </section>

          <section className="gap-ps-5 px-ps-5 py-ps-6 flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between">
              <div className="gap-ps-2 text-label text-faint flex items-center uppercase tracking-widest">
                <Sparkles
                  className="text-muted h-3.5 w-3.5"
                  aria-hidden="true"
                />
                <h2>Prompts</h2>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="px-ps-3 text-button-12 rounded-full shadow-sm"
                onClick={onCreateNew}
              >
                <span>+ New</span>
                <span className="text-label-sm text-foreground/80">
                  {modKey === 'Cmd' ? 'Cmd+N' : 'Ctrl+N'}
                </span>
              </Button>
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
                placeholder="Search prompts..."
                aria-label="Search prompts"
                className="h-ps-9 border-border bg-surface-2/60 pl-ps-7 pr-ps-3 text-body-sm text-foreground focus-visible:border-border-strong focus-visible:ring-accent/40 rounded-lg border focus-visible:ring-1"
              />
            </div>

            <div className="gap-ps-2 flex flex-wrap items-center">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className={cn(
                  'border-border px-ps-3 text-label-sm text-muted rounded-full border transition-colors',
                  filterState.videosOnly &&
                    'border-border-strong bg-surface-2 text-foreground'
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
                  'border-border px-ps-3 text-label-sm text-muted rounded-full border transition-colors',
                  filterState.recentOnly &&
                    'border-border-strong bg-surface-2 text-foreground'
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
                  <ul className="gap-ps-3 flex flex-col">
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

          <footer className="px-ps-5 pb-ps-5 pt-ps-4">
            <div className="ps-divider-fade mb-ps-4" aria-hidden="true" />
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
