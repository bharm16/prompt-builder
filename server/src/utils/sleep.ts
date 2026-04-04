export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute a polling delay with optional exponential backoff and jitter.
 * @param baseMs Base poll interval
 * @param elapsedMs Time elapsed since polling started
 * @param backoffAfterMs Start backing off after this many ms (default: 30000)
 * @param maxMultiplier Maximum multiplier for backoff (default: 2)
 * @param jitterFraction Jitter fraction (default: 0.25)
 */
export function pollingDelay(
  baseMs: number,
  elapsedMs: number,
  backoffAfterMs = 30_000,
  maxMultiplier = 2,
  jitterFraction = 0.25,
): number {
  let delay = baseMs;
  if (elapsedMs > backoffAfterMs) {
    const multiplier = Math.min(
      maxMultiplier,
      1 + (elapsedMs - backoffAfterMs) / backoffAfterMs,
    );
    delay = Math.round(baseMs * multiplier);
  }
  const jitter = delay * jitterFraction * (2 * Math.random() - 1);
  return Math.max(100, Math.round(delay + jitter));
}
