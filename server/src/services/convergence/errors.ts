/**
 * Error types for the Visual Convergence feature
 */

/**
 * Error codes for convergence operations
 */
export type ConvergenceErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'ACTIVE_SESSION_EXISTS'
  | 'INSUFFICIENT_CREDITS'
  | 'REGENERATION_LIMIT_EXCEEDED'
  | 'DEPTH_ESTIMATION_FAILED'
  | 'IMAGE_GENERATION_FAILED'
  | 'VIDEO_GENERATION_FAILED'
  | 'INCOMPLETE_SESSION'
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST';

/**
 * Custom error class for convergence operations
 * Provides structured error information with error codes and optional details
 */
export class ConvergenceError extends Error {
  public readonly code: ConvergenceErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: ConvergenceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'ConvergenceError';
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConvergenceError);
    }
  }

  /**
   * Returns a user-friendly error message based on the error code
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'SESSION_NOT_FOUND':
        return 'Session not found. Please start a new session.';
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please start a new session.';
      case 'ACTIVE_SESSION_EXISTS':
        return 'You already have an active session. Please resume or abandon it first.';
      case 'INSUFFICIENT_CREDITS':
        return 'Insufficient credits. Please purchase more credits to continue.';
      case 'REGENERATION_LIMIT_EXCEEDED':
        return 'You have reached the maximum number of regenerations for this dimension.';
      case 'DEPTH_ESTIMATION_FAILED':
        return 'Failed to estimate depth. Camera motion preview is unavailable.';
      case 'IMAGE_GENERATION_FAILED':
        return 'Failed to generate images. Please try again.';
      case 'VIDEO_GENERATION_FAILED':
        return 'Failed to generate video preview. Please try again.';
      case 'INCOMPLETE_SESSION':
        return 'Please complete all required selections before finalizing.';
      case 'UNAUTHORIZED':
        return 'You are not authorized to access this session.';
      case 'INVALID_REQUEST':
        return 'Invalid request. Please check your inputs.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Returns the HTTP status code for this error
   */
  getHttpStatus(): number {
    switch (this.code) {
      case 'SESSION_NOT_FOUND':
        return 404;
      case 'SESSION_EXPIRED':
        return 410; // Gone
      case 'ACTIVE_SESSION_EXISTS':
        return 409; // Conflict
      case 'INSUFFICIENT_CREDITS':
        return 402; // Payment Required
      case 'REGENERATION_LIMIT_EXCEEDED':
        return 429; // Too Many Requests
      case 'DEPTH_ESTIMATION_FAILED':
      case 'IMAGE_GENERATION_FAILED':
      case 'VIDEO_GENERATION_FAILED':
        return 502; // Bad Gateway (external service failure)
      case 'INCOMPLETE_SESSION':
        return 400; // Bad Request
      case 'UNAUTHORIZED':
        return 403; // Forbidden
      case 'INVALID_REQUEST':
        return 400; // Bad Request
      default:
        return 500;
    }
  }

  /**
   * Converts the error to a JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.getUserMessage(),
      details: this.details,
    };
  }
}

/**
 * Type guard to check if an error is a ConvergenceError
 */
export function isConvergenceError(error: unknown): error is ConvergenceError {
  return error instanceof ConvergenceError;
}
