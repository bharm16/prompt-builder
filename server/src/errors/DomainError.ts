/**
 * Base class for structured domain errors.
 *
 * Subclasses provide a typed error code, an HTTP status mapping, and a
 * user-safe message.  The global error-handler middleware recognises any
 * `DomainError` instance and returns a consistent `ApiError` response
 * without the route needing to catch-and-format manually.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }

  abstract getHttpStatus(): number;
  abstract getUserMessage(): string;

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.getUserMessage(),
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
