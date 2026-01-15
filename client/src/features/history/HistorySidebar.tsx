import React from 'react';
import {
  ArrowRight as LogIn,
  ChevronLeft as PanelLeft,
  User as UserIcon,
} from '@geist-ui/icons';
import { getAuthRepository } from '@repositories/index';
import { HistoryEmptyState } from '@components/EmptyState';
import { useToast } from '@components/Toast';
import { Button } from '@components/Button';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { User, PromptHistoryEntry } from '@hooks/types';
import { HistoryItem } from './components/HistoryItem';
import { AuthMenu } from './components/AuthMenu';
import './HistorySidebar.css';

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

function stageColor(stage: PromptRowStage): string {
  if (stage === 'generated') return '#22C55E';
  if (stage === 'optimized') return '#8B5CF6';
  if (stage === 'error') return '#F59E0B';
  return '#A1A1AA';
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

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  const activeDotColor = stageColor(activeStage);
  const activeDotGlow = hexToRgba(activeDotColor, 0.4);

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
      className={`po-sidebar ${isCollapsed ? 'po-sidebar--collapsed' : 'po-sidebar--expanded'}`}
      aria-label="Prompt history"
      onMouseEnter={handleSidebarMouseEnter}
      onMouseLeave={handleSidebarMouseLeave}
    >
      {isCollapsed ? (
        <div className="po-sidebar__collapsed">
          <button
            type="button"
            onClick={() => {
              hoverExpandedRef.current = false;
              setShowHistory(true);
            }}
            className="po-sidebar__logo-btn"
            aria-label="Expand sidebar"
            title="Vidra"
          >
            <span className="po-sidebar__logo-text">V</span>
          </button>

          <div className="po-sidebar__divider" aria-hidden="true" />

          <div className="po-sidebar__collapsed-timeline">
            <div
              className="po-sidebar__collapsed-active"
              style={{
                backgroundColor: activeDotColor,
                boxShadow: `0 0 0 2px ${activeDotGlow}`,
              }}
              aria-label="Active prompt"
              role="img"
            />

            {collapsedTimeline.entries.map((entry) => {
              const key = (entry.id || entry.uuid) as string | undefined;
              const color = stageColor(resolveEntryStage(entry));
              return (
                <button
                  key={key ?? `${entry.timestamp ?? ''}-${entry.input.slice(0, 8)}`}
                  type="button"
                  className="po-sidebar__timeline-dot"
                  style={{ backgroundColor: color }}
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
              <div className="po-sidebar__timeline-overflow" aria-label={`+${collapsedTimeline.overflow} more prompts`}>
                +{collapsedTimeline.overflow}
              </div>
            )}
          </div>

          <div className="po-sidebar__divider" aria-hidden="true" />

          <button
            type="button"
            onClick={onCreateNew}
            className="po-sidebar__icon-btn"
            aria-label="New prompt"
            title="New prompt"
          >
            <span>+</span>
          </button>

          <div className="po-sidebar__divider" aria-hidden="true" />

          <div className="po-sidebar__collapsed-footer">
            {!user ? (
              <button
                type="button"
                onClick={handleSignIn}
                className="po-sidebar__icon-btn"
                aria-label="Sign in"
                title="Sign in"
              >
                <LogIn size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  hoverExpandedRef.current = false;
                  setShowHistory(true);
                }}
                className="po-sidebar__avatar-btn"
                aria-label="User menu"
                title={typeof user.displayName === 'string' ? user.displayName : 'User'}
              >
                {typeof user.photoURL === 'string' && user.photoURL ? (
                  <img src={user.photoURL} alt="" />
                ) : (
                  <UserIcon size={18} />
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="po-sidebar__expanded">
          <header className="po-sidebar__header">
            <div className="po-sidebar__header-row">
              <h1>Vidra</h1>
              <Button
                onClick={() => {
                  hoverExpandedRef.current = false;
                  setShowHistory(false);
                }}
                svgOnly
                variant="ghost"
                prefix={<PanelLeft size={20} />}
                aria-label="Collapse sidebar"
              />
            </div>
          </header>

          <section className="po-sidebar__active" aria-label="Active prompt">
            <div className="po-sidebar__active-head">
              <span>ACTIVE PROMPT</span>
              <span className="po-sidebar__active-rule" aria-hidden="true" />
            </div>
            <div className="po-sidebar__active-card">
              <span
                className="po-sidebar__active-dot"
                style={{ backgroundColor: activeDotColor }}
                aria-hidden="true"
              />
              <div className="po-sidebar__active-body">
                <div className="po-sidebar__active-title" title={activeTitle}>
                  {activeTitle}
                </div>
                <div className="po-sidebar__active-meta">
                  <span className="po-sidebar__active-label">Status:</span> {activeStatusLabel}
                  <span className="po-sidebar__active-sep" aria-hidden="true">·</span>
                  <span className="po-sidebar__active-label">Model:</span> {activeModelLabel}
                  {typeof activeDurationS === 'number' ? (
                    <>
                      <span className="po-sidebar__active-sep" aria-hidden="true">·</span>
                      <span className="po-sidebar__active-label">Duration:</span> {activeDurationS}s
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="po-sidebar__section po-sidebar__section--sessions">
            <div className="po-sidebar__section-head">
              <h2>Prompts</h2>
              <button type="button" className="po-sidebar__ghost" onClick={onCreateNew}>
                + New
              </button>
            </div>

            <div className="po-sidebar__search">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search prompts..."
                aria-label="Search prompts"
              />
            </div>

            {isLoadingHistory ? (
              <div className="po-sidebar__empty">
                <div className="spinner-sm" />
                <p>Loading...</p>
              </div>
            ) : filteredHistory.length === 0 && searchQuery ? (
              <div className="po-sidebar__empty">
                <p>No results for &quot;{searchQuery}&quot;.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <HistoryEmptyState onCreateNew={onCreateNew} />
            ) : (
              <>
                <nav aria-label="Prompts list" className="po-sidebar__sessions">
                  <ul>
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
                    size="small"
                    className="po-sidebar__see-more"
                  >
                    {showAllHistory ? 'See less' : 'See more...'}
                  </Button>
                )}
              </>
            )}
          </section>

          <footer className="po-sidebar__auth">
            <AuthMenu user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
          </footer>
        </div>
      )}
    </aside>
  );
}
