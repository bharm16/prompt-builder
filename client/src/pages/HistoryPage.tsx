import React from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from '@promptstudio/system/components/ui';
import { Container, Section } from '@components/layout';
import { useAuthUser } from '@hooks/useAuthUser';
import { usePromptHistory } from '@hooks/usePromptHistory';
import type { PromptHistoryEntry } from '@hooks/types';
import { Button } from '@promptstudio/system/components/ui/button';
import { Card } from '@promptstudio/system/components/ui/card';
import { Input } from '@promptstudio/system/components/ui/input';

function formatRelativeOrDate(iso: string | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso);
  const ms = t.getTime();
  if (Number.isNaN(ms)) return '—';
  const diffMs = Date.now() - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 0) return t.toLocaleDateString();
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 14) return `${diffDays}d ago`;
  return t.toLocaleDateString();
}

function deriveTitle(entry: PromptHistoryEntry): string {
  const storedTitle = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (storedTitle) return storedTitle;
  const source = (entry.output || '').trim().replace(/\s+/g, ' ');
  if (!source) return 'Untitled prompt';
  return source.length > 96 ? `${source.slice(0, 96).trim()}…` : source;
}

function deriveSnippet(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '—';
  return normalized;
}

export function HistoryPage(): React.ReactElement {
  const user = useAuthUser();

  const promptHistory = usePromptHistory(user);
  const filteredOutputs = React.useMemo(() => {
    const q = promptHistory.searchQuery.trim().toLowerCase();
    if (!q) return promptHistory.history;
    return promptHistory.history.filter((entry) => entry.output.toLowerCase().includes(q));
  }, [promptHistory.history, promptHistory.searchQuery]);

  return (
    <div className="h-full overflow-y-auto bg-app">
      <Section spacing="ps-6">
        <Container size="lg">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-1 p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              aria-hidden="true"
              style={{
                background:
                  'radial-gradient(900px 260px at 8% 10%, rgba(12,143,235,0.20), transparent 60%), radial-gradient(900px 320px at 92% 0%, rgba(168,85,247,0.18), transparent 55%), radial-gradient(760px 260px at 60% 90%, rgba(255,56,92,0.14), transparent 55%)',
              }}
            />

            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                  History
                </h1>
                <p className="text-muted max-w-2xl">
                  Search across every optimized output you’ve saved.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint"
                    aria-hidden="true"
                  />
                  <Input
                    className="pl-11 pr-10"
                    type="search"
                    value={promptHistory.searchQuery}
                    onChange={(e) => promptHistory.setSearchQuery(e.target.value)}
                    placeholder="Search prompts…"
                    aria-label="Search prompt history"
                  />
                  {promptHistory.searchQuery ? (
                    <Button
                      type="button"
                      onClick={() => promptHistory.setSearchQuery('')}
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md p-0 transition-colors hover:bg-surface-1"
                      aria-label="Clear search"
                      title="Clear"
                    >
                      <X className="h-4 w-4 text-muted" aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-sm text-muted">
                  <span className="tabular-nums">
                    {filteredOutputs.length}
                    {promptHistory.searchQuery ? ' results' : ' prompts'}
                  </span>
                  {user ? (
                    <span className="px-2 py-0.5 rounded-full border border-border bg-surface-1 text-xs text-muted">
                      Synced
                    </span>
                  ) : (
                    <Button
                      asChild
                      variant="ghost"
                      className="h-auto px-2 py-0.5 rounded-full border border-border bg-surface-1 text-xs text-muted hover:text-foreground"
                    >
                      <Link to="/signin?redirect=/history">Sign in to sync</Link>
                    </Button>
                  )}
                  <Button
                    asChild
                    variant="link"
                    className="h-auto p-0 font-medium text-foreground hover:underline"
                  >
                    <Link to="/">Back to app</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Container size="lg">
        {promptHistory.isLoadingHistory ? (
          <div className="py-12 text-center">
            <div className="ps-spinner-sm mx-auto mb-3" />
            <p className="text-sm text-muted">Loading history…</p>
          </div>
        ) : filteredOutputs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">
              {promptHistory.searchQuery
                ? `No results for “${promptHistory.searchQuery}”.`
                : 'No prompts saved yet.'}
            </p>
          </div>
        ) : (
          <div className="pb-16 grid grid-cols-1 gap-4">
            {filteredOutputs.map((entry, index) => {
              const title = deriveTitle(entry);
              const uuid = typeof entry.uuid === 'string' ? entry.uuid : null;
              const sessionId = typeof entry.id === 'string' ? entry.id : null;
              const when = formatRelativeOrDate(entry.timestamp);
              const mode = typeof entry.mode === 'string' && entry.mode.trim() ? entry.mode.trim() : null;
              const model =
                typeof entry.targetModel === 'string' && entry.targetModel.trim()
                  ? entry.targetModel.trim()
                  : null;

              return (
                <article
                  key={entry.id ?? entry.uuid ?? `${entry.timestamp ?? 'no-ts'}-${index}`}
                  className="ps-border-gradient rounded-lg"
                >
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-foreground truncate" title={title}>
                          {title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="tabular-nums">{when}</span>
                          {mode ? (
                            <span className="px-2 py-0.5 rounded-full border border-border bg-surface-1">
                              {mode}
                            </span>
                          ) : null}
                          {model ? (
                            <span className="px-2 py-0.5 rounded-full border border-border bg-surface-1">
                              {model}
                            </span>
                          ) : null}
                          {typeof entry.score === 'number' ? (
                            <span className="px-2 py-0.5 rounded-full border border-border bg-surface-1 tabular-nums">
                              Score {Math.round(entry.score)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {sessionId ? (
                        <Link
                          to={`/session/${sessionId}/studio`}
                          className="shrink-0 text-sm font-medium text-foreground hover:underline"
                          aria-label="Open prompt"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-lg border border-border bg-surface-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold tracking-wide text-muted">
                          OUTPUT
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground ps-line-clamp-3 whitespace-pre-wrap break-words">
                        {deriveSnippet(entry.output)}
                      </p>
                    </div>

                    {uuid ? (
                      <div className="mt-4 text-xs text-muted">
                        <span className="font-medium text-muted">UUID:</span>{' '}
                        <span className="font-mono">{uuid}</span>
                      </div>
                    ) : null}
                  </Card>
                </article>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
