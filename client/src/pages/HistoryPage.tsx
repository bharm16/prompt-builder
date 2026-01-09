import React from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Container, Section } from '@components/layout';
import { getAuthRepository } from '@repositories/index';
import { usePromptHistory } from '@hooks/usePromptHistory';
import type { PromptHistoryEntry, User } from '@hooks/types';

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
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const promptHistory = usePromptHistory(user);
  const filteredOutputs = React.useMemo(() => {
    const q = promptHistory.searchQuery.trim().toLowerCase();
    if (!q) return promptHistory.history;
    return promptHistory.history.filter((entry) => entry.output.toLowerCase().includes(q));
  }, [promptHistory.history, promptHistory.searchQuery]);

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-neutral-50 via-white to-neutral-50">
      <Section spacing="geist-base">
        <Container size="lg">
          <div className="relative overflow-hidden rounded-geist-lg border border-geist-accents-2 bg-white p-6">
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
                <h1 className="text-3xl font-semibold text-geist-foreground tracking-tight">
                  History
                </h1>
                <p className="text-geist-accents-6 max-w-2xl">
                  Search across every optimized output you’ve saved.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-geist-accents-4"
                    aria-hidden="true"
                  />
                  <input
                    className="input input-search pr-10"
                    type="search"
                    value={promptHistory.searchQuery}
                    onChange={(e) => promptHistory.setSearchQuery(e.target.value)}
                    placeholder="Search prompts…"
                    aria-label="Search prompt history"
                  />
                  {promptHistory.searchQuery ? (
                    <button
                      type="button"
                      onClick={() => promptHistory.setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-geist hover:bg-geist-accents-1 transition-colors"
                      aria-label="Clear search"
                      title="Clear"
                    >
                      <X className="h-4 w-4 text-geist-accents-5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 text-sm text-geist-accents-6">
                  <span className="tabular-nums">
                    {filteredOutputs.length}
                    {promptHistory.searchQuery ? ' results' : ' prompts'}
                  </span>
                  {user ? (
                    <span className="px-2 py-0.5 rounded-full border border-geist-accents-2 bg-geist-accents-1 text-xs text-geist-accents-6">
                      Synced
                    </span>
                  ) : (
                    <Link
                      to="/signin?redirect=/history"
                      className="px-2 py-0.5 rounded-full border border-geist-accents-2 bg-geist-accents-1 text-xs text-geist-accents-6 hover:text-geist-foreground"
                    >
                      Sign in to sync
                    </Link>
                  )}
                  <Link
                    to="/"
                    className="text-geist-foreground hover:underline font-medium"
                  >
                    Back to app
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Container size="lg">
        {promptHistory.isLoadingHistory ? (
          <div className="py-12 text-center">
            <div className="spinner-sm mx-auto mb-3" />
            <p className="text-sm text-geist-accents-6">Loading history…</p>
          </div>
        ) : filteredOutputs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-geist-accents-6">
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
              const when = formatRelativeOrDate(entry.timestamp);
              const mode = typeof entry.mode === 'string' && entry.mode.trim() ? entry.mode.trim() : null;
              const model =
                typeof entry.targetModel === 'string' && entry.targetModel.trim()
                  ? entry.targetModel.trim()
                  : null;

              return (
                <article
                  key={entry.id ?? entry.uuid ?? `${entry.timestamp ?? 'no-ts'}-${index}`}
                  className="border-gradient rounded-geist-lg"
                >
                  <div className="card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-geist-foreground truncate" title={title}>
                          {title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-geist-accents-5">
                          <span className="tabular-nums">{when}</span>
                          {mode ? (
                            <span className="px-2 py-0.5 rounded-full border border-geist-accents-2 bg-geist-accents-1">
                              {mode}
                            </span>
                          ) : null}
                          {model ? (
                            <span className="px-2 py-0.5 rounded-full border border-geist-accents-2 bg-geist-accents-1">
                              {model}
                            </span>
                          ) : null}
                          {typeof entry.score === 'number' ? (
                            <span className="px-2 py-0.5 rounded-full border border-geist-accents-2 bg-geist-accents-1 tabular-nums">
                              Score {Math.round(entry.score)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {uuid ? (
                        <Link
                          to={`/prompt/${uuid}`}
                          className="shrink-0 text-sm font-medium text-geist-foreground hover:underline"
                          aria-label="Open prompt"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-geist-lg border border-geist-accents-2 bg-geist-accents-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold tracking-wide text-geist-accents-6">
                          OUTPUT
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-geist-foreground line-clamp-3 whitespace-pre-wrap break-words">
                        {deriveSnippet(entry.output)}
                      </p>
                    </div>

                    {uuid ? (
                      <div className="mt-4 text-xs text-geist-accents-5">
                        <span className="font-medium text-geist-accents-6">UUID:</span>{' '}
                        <span className="font-mono">{uuid}</span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
