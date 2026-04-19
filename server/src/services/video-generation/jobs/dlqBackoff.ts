/**
 * Backoff schedule for re-attempting a DLQ entry. Doubling with a floor of
 * 30s and a ceiling of 5 minutes, plus deterministic ±20% jitter so that a
 * batch of entries failing in the same provider outage do not re-fire in
 * lockstep. Jitter source is `now` (not Math.random) so the function is
 * unit-testable without time travel.
 */

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 5 * 60 * 1_000;

export function computeDlqBackoff(
  attempt: number,
  now: number = Date.now(),
): number {
  const safeAttempt =
    Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const exponential = BASE_DELAY_MS * 2 ** safeAttempt;
  const capped = Math.min(exponential, MAX_DELAY_MS);
  // (now % 1000) - 500 is in [-500, 499]. Scaling by capped/2500 gives
  // roughly ±20% of the capped delay.
  const jitter = Math.floor((now % 1000) - 500) * (capped / 2500);
  const jittered = Math.floor(capped + jitter);
  return Math.max(BASE_DELAY_MS, Math.min(MAX_DELAY_MS, jittered));
}
