/**
 * Backoff schedule for retrying a video job after a transient failure.
 * Doubling with a floor of 30s and a ceiling of 5 minutes, plus small jitter
 * to prevent thundering retries when many jobs fail simultaneously.
 */

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 5 * 60 * 1_000;

export function computeRetryBackoffMs(
  attempt: number,
  now: number = Date.now(),
): number {
  const safeAttempt =
    Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const exponential = BASE_DELAY_MS * 2 ** safeAttempt;
  const capped = Math.min(exponential, MAX_DELAY_MS);
  // Deterministic jitter derived from `now` so tests can reason about it:
  // ±10% of the capped delay.
  const jitter = Math.floor((now % 1000) - 500) * (capped / 5000);
  // Re-apply the ceiling AFTER jitter so the documented max actually holds.
  const jittered = Math.floor(capped + jitter);
  return Math.max(BASE_DELAY_MS, Math.min(MAX_DELAY_MS, jittered));
}
