import { ApiError } from '../ApiClient';
import type {
  OptimizeOptions,
  OptimizeWithStreamingOptions,
  OptimizeWithStreamingResult,
  OfflineResult,
} from './types';

export function emitOfflineCallbacks(
  result: OfflineResult,
  {
    onDraft,
    onSpans,
    onRefined,
  }: Pick<OptimizeWithStreamingOptions, 'onDraft' | 'onSpans' | 'onRefined'>
): void {
  if (typeof onDraft === 'function') {
    onDraft(result.draft);
  }

  if (typeof onSpans === 'function') {
    onSpans([], 'offline-fallback', result.metadata);
  }

  if (typeof onRefined === 'function') {
    onRefined(result.refined, result.metadata);
  }
}

export function shouldUseOfflineFallback(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const err = error as Error & {
    status?: number;
    response?: { status?: number };
  };

  const status =
    err.status ??
    err?.response?.status ??
    (err instanceof ApiError ? err.status : null);
  if (status === 401 || status === 403) {
    return true;
  }

  const message = (err.message || '').toLowerCase();
  return (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('permission')
  );
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as { name?: string; code?: string };
  return err.name === 'AbortError' || err.code === 'ABORT_ERR';
}

export function buildOfflineResult(
  { prompt, mode }: OptimizeOptions,
  error: unknown
): OfflineResult {
  const trimmedPrompt = (prompt || '').trim();
  const normalizedMode = mode ? mode.replace(/-/g, ' ') : 'optimize';

  const baselineSuggestions = [
    'Clarify the intended audience and the desired tone.',
    'Specify any formatting or length requirements for the response.',
    'Add relevant context, constraints, or examples that the model should follow.',
  ];

  const suggestionList = baselineSuggestions.map((tip) => `- ${tip}`).join('\n');

  const draft = [
    `✨ Offline Prompt Assistant (${normalizedMode})`,
    '',
    trimmedPrompt
      ? `Original prompt:\n${trimmedPrompt}`
      : 'No original prompt was provided.',
    '',
    'Quick tips to strengthen your prompt:',
    suggestionList,
  ].join('\n');

  const refined = [
    draft,
    '',
    'This locally generated guidance is shown because the live optimization API could not be reached (401 Unauthorized).',
    'Update your API credentials or start the backend service to restore real-time optimizations.',
  ].join('\n');

  const err = error as Error | null;
  const metadata = {
    usedFallback: true,
    offline: true,
    reason: 'unauthorized',
    errorMessage: err?.message || null,
  };

  return {
    draft,
    refined,
    spans: [],
    metadata,
    usedFallback: true,
  };
}

export function handleOfflineFallback(
  options: OptimizeWithStreamingOptions,
  error: unknown
): OptimizeWithStreamingResult {
  const offlineResult = buildOfflineResult(options, error);
  emitOfflineCallbacks(offlineResult, options);
  return offlineResult;
}
