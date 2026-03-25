/**
 * Shared Transient Error Detection
 *
 * Centralizes the logic for determining whether an error is transient
 * (i.e. retryable) across all service domains. Domain-specific detectors
 * compose on top of this shared set.
 */

/**
 * Message substrings that indicate a transient/retryable failure
 * regardless of the originating service.
 */
const TRANSIENT_MESSAGE_HINTS = [
  "timed out",
  "timeout",
  "etimedout",
  "econnreset",
  "econnrefused",
  "econnaborted",
  "epipe",
  "enetunreach",
  "service unavailable",
  "temporarily unavailable",
  "resource exhausted",
  "rate limit",
  "429",
  "deadline exceeded",
  "connection reset",
  "socket hang up",
  "fetch failed",
] as const;

/**
 * Firestore gRPC status codes that represent transient failures.
 */
const TRANSIENT_FIRESTORE_CODES = new Set([
  "aborted",
  "cancelled",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  if (!("code" in error)) {
    return null;
  }

  const candidate = (error as { code?: unknown }).code;
  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Check if an error message contains any known transient failure hints.
 */
export function hasTransientMessageHint(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return TRANSIENT_MESSAGE_HINTS.some((hint) => message.includes(hint));
}

/**
 * Check if an error is a transient Firestore error
 * (gRPC status code match OR message hint match).
 */
export function isTransientFirestoreError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code && TRANSIENT_FIRESTORE_CODES.has(code)) {
    return true;
  }

  return hasTransientMessageHint(error);
}

/**
 * Generic transient error check.
 * Returns true for network-level failures that any service might encounter.
 * Domain-specific code should use the more specific variants
 * (e.g. `isTransientFirestoreError`) when available.
 */
export function isTransientError(error: unknown): boolean {
  return hasTransientMessageHint(error);
}
