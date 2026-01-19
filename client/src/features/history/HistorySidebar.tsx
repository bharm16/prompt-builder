import React from 'react';
import {
  ArrowRight as LogIn,
  ChevronLeft as PanelLeft,
  User as UserIcon,
} from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { HistoryEmptyState } from '@components/EmptyState';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { Input } from '@promptstudio/system/components/ui/input';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { User, PromptHistoryEntry } from '@hooks/types';
import { HistoryItem } from './components/HistoryItem';
import { AuthMenu } from './components/AuthMenu';
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
  currentPromptUuid?: string | null;
  currentPromptDocId?: string | null;
  activeTitle: string;
  activeStage: PromptRowStage;
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
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function clampTitle(value: string): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v) return 'Untitled';
  return v.length > 48 ? `${v.slice(0, 48).trim()}…` : v;
}

const STAGE_COLOR_CLASSES: Record<PromptRowStage, { bg: string; ring: string }> = {
  generated: { bg: 'bg-success', ring: 'ring-success/40' },
  optimized: { bg: 'bg-accent-2', ring: 'ring-accent-2/40' },
  error: { bg: 'bg-warning', ring: 'ring-warning/40' },
  draft: { bg: 'bg-muted', ring: 'ring-muted/40' },
};

function stageColorClasses(stage: PromptRowStage): { bg: string; ring: string } {
  return STAGE_COLOR_CLASSES[stage] ?? STAGE_COLOR_CLASSES.draft;
}

function resolveEntryStage(entry: PromptHistoryEntry): PromptRowStage {
  const hasInput = typeof entry.input === 'string' && entry.input.trim().length > 0;
  const hasOutput = typeof entry.output === 'string' && entry.output.trim().length > 0;
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
  return formatShortDate(iso);
}

function extractDurationS(entry: PromptHistoryEntry, selectedFallback: number | null): number | null {
  const fromEntry = (entry.generationParams as Record<string, unknown> | null | undefined)?.duration_s;
  if (typeof fromEntry === 'number' && Number.isFinite(fromEntry)) return fromEntry;
  if (typeof fromEntry === 'string' && fromEntry.trim() && !Number.isNaN(Number(fromEntry))) return Number(fromEntry);
  if (typeof selectedFallback === 'number' && Number.isFinite(selectedFallback)) return selectedFallback;
  return 6;
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
  while (start < rawTokens.length && stop.has(rawTokens[start]?.toLowerCase() ?? '')) start += 1;

  const tokens = rawTokens.slice(start);
  if (tokens.length === 0) return 'Untitled';

  const first = tokens[0] ?? '';
  const second = tokens[1] ?? '';
  const third = tokens[2] ?? '';
  const secondLower = second.toLowerCase();

  const nounFollowers = new Set(['chase', 'battle', 'portrait', 'scene', 'shot', 'sequence', 'close-up', 'closeup']);
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

function modelShortName(targetModel: string | null | undefined): string | null {
  if (!targetModel || !targetModel.trim()) return null;
  const lower = targetModel.toLowerCase();
  if (lower.includes('luma')) return 'Luma';
  if (lower.includes('runway')) return 'Runway';
  if (lower.includes('veo')) return 'Veo';
  if (lower.includes('sora')) return 'Sora';
  return targetModel.trim().split(/\s+/)[0] ?? null;
}

function normalizeProcessingLabel(label: string): string | null {
  const raw = label.trim();
  if (!raw) return null;
  if (raw.endsWith('…')) return raw;
  return `${raw}…`;
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
  currentPromptUuid,
  currentPromptDocId,
  activeTitle,
  activeStage,
  activeStatusLabel,
  activeModelLabel,
  activeDurationS,
}: HistorySidebarProps): React.ReactElement {
  const debug = useDebugLogger('HistorySidebar', {
    historyCount: history.length,
    isExpanded: showHistory,
    isAuthenticated: !!user
  });
  const toast = useToast();
  const [showAllHistory, setShowAllHistory] = React.useState<boolean>(false);
  const hoverExpandedRef = React.useRef<boolean>(false);
  const [hoveredEntryKey, setHoveredEntryKey] = React.useState<string | null>(null);

  // Determine which history items to display
  const displayedHistory = showAllHistory 
    ? filteredHistory 
    : filteredHistory.slice(0, INITIAL_HISTORY_LIMIT);

  const handleSignIn = async (): Promise<void> => {
    debug.logAction('signIn');
    debug.startTimer('signIn');
    try {
      const authRepository = getAuthRepository();
      const signedInUser = await authRepository.signInWithGoogle();
      const displayName = typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
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

  const activeDotClasses = stageColorClasses(activeStage);

  const promptRows = React.useMemo(() => {
    const baseTitles = displayedHistory.map((entry) => clampTitle(deriveBaseTitle(entry.input)));
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
      const durationS = extractDurationS(entry, isSelected ? activeDurationS : null);
      const durationLabel = typeof durationS === 'number' ? `${durationS}s` : '—s';

      const baseActionLabel =
        stage === 'generated'
          ? 'Generated'
          : stage === 'optimized'
            ? 'Optimized'
            : stage === 'draft'
              ? 'Draft'
              : 'Generation failed';

      const normalizedActiveProcessing =
        activeStatusLabel === 'Optimizing' ? 'Refining' : activeStatusLabel;
      const processingLabel = isSelected ? normalizeProcessingLabel(normalizedActiveProcessing) : null;
      const effectiveProcessingLabel =
        isSelected && (activeStatusLabel === 'Refining' || activeStatusLabel === 'Optimizing')
          ? processingLabel
          : null;

      const meta = `${dateLabel} · ${durationLabel} · ${baseActionLabel}`;

      const disambiguator =
        extractDisambiguator(entry.input) ??
        (() => {
          const model = modelShortName(typeof entry.targetModel === 'string' ? entry.targetModel : null);
          if (!model) return null;
          return nextSeen === 1 ? model : `alt ${nextSeen}`;
        })() ??
        `alt ${nextSeen}`;

      const title = hasDupes ? `${baseTitle} — ${disambiguator}` : baseTitle;

      const key = (entry.id || entry.uuid || `${entry.timestamp ?? ''}-${title}`) as string;

      return {
        entry,
        stage,
        title,
        meta,
        isSelected,
        processingLabel: effectiveProcessingLabel,
        key,
      };
    });
  }, [displayedHistory, currentPromptUuid, currentPromptDocId, activeDurationS, activeStatusLabel]);

  const collapsedTimeline = React.useMemo(() => {
    const entries = filteredHistory.slice(0, COLLAPSED_TIMELINE_MAX);
    const overflow = Math.max(0, filteredHistory.length - COLLAPSED_TIMELINE_MAX);
    return { entries, overflow };
  }, [filteredHistory]);

  return (
    <aside
      id="history-sidebar"
      className={cn(
        'flex h-full min-h-0 flex-none flex-col overflow-hidden border-r border-border bg-surface-1 transition-all duration-150',
        // Enforce a hard cap so the sidebar can't expand due to missing/overridden token CSS.
        isCollapsed ? 'w-20' : 'w-[260px] min-w-0 max-w-[260px] basis-[260px]'
      )}
      aria-label="Prompt history"
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {isCollapsed ? (
        <div className="flex h-full flex-col items-center gap-4 py-4">
          <Button
            type="button"
            onClick={() => {
              hoverExpandedRef.current = false;
              setShowHistory(true);
            }}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg border border-border bg-surface-2 text-muted transition-all duration-150 hover:-translate-y-px hover:border-border-strong"
            aria-label="Expand sidebar"
            title="Vidra"
          >
            <span className="text-body font-bold text-foreground">V</span>
          </Button>

          <div className="h-px w-full bg-border" aria-hidden="true" />

          <div className="flex flex-col items-center gap-3 py-3">
            <div
              className={cn(
                'h-2 w-2 rounded-full ring-2 ps-animate-active-dot-pulse',
                activeDotClasses.bg,
                activeDotClasses.ring
              )}
              aria-label="Active prompt"
              role="img"
            />

            {collapsedTimeline.entries.map((entry) => {
              const key = (entry.id || entry.uuid) as string | undefined;
              const stageClasses = stageColorClasses(resolveEntryStage(entry));
              return (
                <Button
                  key={key ?? `${entry.timestamp ?? ''}-${entry.input.slice(0, 8)}`}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform hover:scale-110',
                    stageClasses.bg
                  )}
                  aria-label="Prompt"
                  onMouseEnter={() => setHoveredEntryKey(key ?? null)}
                  onMouseLeave={() => setHoveredEntryKey(null)}
                  onClick={() => {
                    hoverExpandedRef.current = false;
                    setShowHistory(true);
                    onLoadFromHistory(entry);
                  }}
                />
              );
            })}

            {collapsedTimeline.overflow > 0 && (
              <div
                className="mt-2 rounded-full bg-surface-3 px-1.5 py-0.5 text-label-sm text-muted"
                aria-label={`+${collapsedTimeline.overflow} more prompts`}
              >
                +{collapsedTimeline.overflow}
              </div>
            )}
          </div>

          <div className="h-px w-full bg-border" aria-hidden="true" />

          <Button
            type="button"
            onClick={onCreateNew}
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg border border-border bg-surface-2 text-muted transition-all duration-150 hover:-translate-y-px hover:border-border-strong"
            aria-label="New prompt"
            title="New prompt"
          >
            <span>+</span>
          </Button>

          <div className="h-px w-full bg-border" aria-hidden="true" />

          <div className="mt-auto">
            {!user ? (
              <Button
                type="button"
                onClick={handleSignIn}
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-lg border border-border bg-surface-2 text-muted transition-all duration-150 hover:-translate-y-px hover:border-border-strong"
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
                className="h-10 w-10 rounded-lg border border-border bg-surface-2 text-muted transition-all duration-150 hover:-translate-y-px hover:border-border-strong"
                aria-label="User menu"
                title={typeof user.displayName === 'string' ? user.displayName : 'User'}
              >
                {typeof user.photoURL === 'string' && user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <UserIcon size={18} />
                )}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <header className="border-b border-border px-ps-5 py-ps-6">
            <div className="mb-ps-4 flex items-center justify-between">
              <h1 className="text-h3 font-bold tracking-tight text-foreground">Vidra</h1>
              <Button
                onClick={() => {
                  hoverExpandedRef.current = false;
                  setShowHistory(false);
                }}
                variant="ghost"
                size="icon"
                aria-label="Collapse sidebar"
                className="h-9 w-9 rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <PanelLeft size={20} />
              </Button>
            </div>
          </header>

          <section className="mt-ps-5 border-b border-border px-ps-5 pb-ps-5" aria-label="Active prompt">
            <div className="flex items-center gap-ps-3 text-label uppercase tracking-widest text-faint">
              <span>Active Prompt</span>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>
            <div className="mt-ps-4 flex items-start gap-ps-4">
              <span
                className={cn(
                  'mt-2 h-4 w-4 flex-shrink-0 rounded-full ring-2 ring-surface-1/60',
                  activeDotClasses.bg
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="ps-line-clamp-3 text-body-lg font-semibold text-foreground" title={activeTitle}>
                  {activeTitle}
                </div>
                <div className="mt-ps-3 text-body-lg text-muted">
                  <span className="font-semibold text-muted">Status:</span> {activeStatusLabel}
                  <span className="mx-ps-3 text-faint/80" aria-hidden="true">·</span>
                  <span className="font-semibold text-muted">Model:</span> {activeModelLabel}
                  {typeof activeDurationS === 'number' ? (
                    <>
                      <span className="mx-ps-3 text-faint/80" aria-hidden="true">·</span>
                      <span className="font-semibold text-muted">Duration:</span> {activeDurationS}s
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col gap-ps-5 px-ps-5 py-ps-6">
            <div className="flex items-center justify-between">
              <h2 className="text-label uppercase tracking-widest text-faint">Prompts</h2>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-border px-ps-2 py-ps-1 text-label text-muted transition-colors hover:border-border-strong"
                onClick={onCreateNew}
              >
                + New
              </Button>
            </div>

            <div>
              <Input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search prompts..."
                aria-label="Search prompts"
                className="rounded-none border-x-0 border-t-0 border-b border-border bg-transparent px-ps-2 text-body-lg text-foreground focus-visible:border-border-strong"
              />
            </div>

            {isLoadingHistory ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-label-sm text-faint">
                <div className="ps-spinner-sm" />
                <p>Loading...</p>
              </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
              <div className="py-6 text-center text-label-sm text-faint">
                <p>No results for &quot;{searchQuery}&quot;.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <HistoryEmptyState onCreateNew={onCreateNew} />
            ) : (
              <>
                <nav aria-label="Prompts list" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col gap-ps-4">
                    {promptRows.map(({ entry, title, meta, stage, isSelected, processingLabel, key }) => {
                      const externalHover = Boolean(
                        hoveredEntryKey &&
                          (entry.id === hoveredEntryKey || entry.uuid === hoveredEntryKey || key === hoveredEntryKey)
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
                        />
                      );
                    })}
                  </ul>
                </nav>
                {filteredHistory.length > INITIAL_HISTORY_LIMIT && (
                  <Button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-label-sm text-faint"
                  >
                    {showAllHistory ? 'See less' : 'See more...'}
                  </Button>
                )}
              </>
            )}
          </section>

          <footer className="border-t border-border p-ps-5">
            <AuthMenu user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
          </footer>
        </div>
      )}
    </aside>
  );
}
