/**
 * Shared helpers for parsing environment variables in service registration files.
 */

export function resolvePositiveNumber(
  raw: string | undefined,
  fallback: number,
  min = 0
): number {
  const parsed = Number.parseFloat(raw || '');
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function resolveSignedUrlTtlMs(rawSeconds: string | undefined, fallbackMs: number): number {
  const ttlSeconds = Number.parseInt(rawSeconds || '', 10);
  return Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : fallbackMs;
}

export function resolveBoolFlag(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultValue;
}
