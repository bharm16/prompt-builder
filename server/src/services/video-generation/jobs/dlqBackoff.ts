export function computeDlqBackoff(attempt: number): number {
  return Math.min(300_000, 30_000 * Math.pow(2, attempt));
}
