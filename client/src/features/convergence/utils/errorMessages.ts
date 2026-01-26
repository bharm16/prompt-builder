/**
 * Error Messages Utility
 *
 * Provides user-friendly error messages for all ConvergenceErrorCodes.
 * Maps technical error codes to human-readable messages with helpful context.
 *
 * @requirement 11.1 - Display user-friendly error messages
 * @task 37.1 - Add user-friendly error messages for all ConvergenceErrorCodes
 */

import type { ConvergenceErrorCode } from '../types';

/**
 * User-friendly error message configuration
 */
export interface ErrorMessageConfig {
  /** The main error message to display */
  message: string;
  /** Optional title for the error */
  title?: string;
  /** Whether this error is recoverable with a retry */
  isRetryable: boolean;
  /** Suggested action for the user */
  suggestedAction?: string;
}

/**
 * Mapping of error codes to user-friendly messages
 */
export const ERROR_MESSAGES: Record<ConvergenceErrorCode, ErrorMessageConfig> = {
  SESSION_NOT_FOUND: {
    title: 'Session Not Found',
    message: 'We couldn\'t find your session. It may have been deleted or expired.',
    isRetryable: false,
    suggestedAction: 'Please start a new creative session.',
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your session has expired after 24 hours of inactivity.',
    isRetryable: false,
    suggestedAction: 'Please start a new creative session to continue.',
  },
  ACTIVE_SESSION_EXISTS: {
    title: 'Existing Session Found',
    message: 'You already have an active session in progress.',
    isRetryable: false,
    suggestedAction: 'Would you like to resume your existing session or start fresh?',
  },
  INSUFFICIENT_CREDITS: {
    title: 'Insufficient Credits',
    message: 'You don\'t have enough credits to complete this operation.',
    isRetryable: false,
    suggestedAction: 'Purchase more credits to continue creating.',
  },
  REGENERATION_LIMIT_EXCEEDED: {
    title: 'Regeneration Limit Reached',
    message: 'You\'ve reached the maximum number of regenerations (3) for this step.',
    isRetryable: false,
    suggestedAction: 'Please select one of the current options or go back to try a different path.',
  },
  DEPTH_ESTIMATION_FAILED: {
    title: 'Camera Motion Setup Failed',
    message: 'We couldn\'t analyze the image for camera motion effects.',
    isRetryable: true,
    suggestedAction: 'You can retry or use text-based camera motion selection instead.',
  },
  IMAGE_GENERATION_FAILED: {
    title: 'Image Generation Failed',
    message: 'We encountered an issue while generating your images.',
    isRetryable: true,
    suggestedAction: 'Please try again. If the problem persists, try a different prompt.',
  },
  VIDEO_GENERATION_FAILED: {
    title: 'Video Preview Failed',
    message: 'We couldn\'t generate the video preview.',
    isRetryable: true,
    suggestedAction: 'You can retry or skip the preview and proceed to final generation.',
  },
  INCOMPLETE_SESSION: {
    title: 'Incomplete Session',
    message: 'Please complete all required selections before finalizing.',
    isRetryable: false,
    suggestedAction: 'Go back and make sure you\'ve selected options for all steps.',
  },
  UNAUTHORIZED: {
    title: 'Authentication Required',
    message: 'You need to be signed in to use this feature.',
    isRetryable: false,
    suggestedAction: 'Please sign in to continue.',
  },
  INVALID_REQUEST: {
    title: 'Invalid Request',
    message: 'Some required information is missing or invalid.',
    isRetryable: false,
    suggestedAction: 'Please review your inputs and try again.',
  },
};

/**
 * Get user-friendly error message for an error code
 *
 * @param code - The error code from the API
 * @returns The error message configuration
 */
export function getErrorMessage(code: ConvergenceErrorCode): ErrorMessageConfig {
  return ERROR_MESSAGES[code] ?? {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    isRetryable: true,
    suggestedAction: 'Please try again.',
  };
}

/**
 * Get a simple error message string for an error code
 *
 * @param code - The error code from the API
 * @returns A user-friendly error message string
 */
export function getErrorMessageString(code: ConvergenceErrorCode): string {
  const config = getErrorMessage(code);
  return config.message;
}

/**
 * Check if an error is retryable
 *
 * @param code - The error code from the API
 * @returns Whether the operation can be retried
 */
export function isRetryableError(code: ConvergenceErrorCode): boolean {
  const config = getErrorMessage(code);
  return config.isRetryable;
}

/**
 * Network error messages
 */
export const NETWORK_ERROR_MESSAGES = {
  DISCONNECTED: {
    title: 'Connection Lost',
    message: 'You appear to be offline. Please check your internet connection.',
    isRetryable: true,
    suggestedAction: 'We\'ll automatically retry when you\'re back online.',
  },
  TIMEOUT: {
    title: 'Request Timeout',
    message: 'The request took too long to complete.',
    isRetryable: true,
    suggestedAction: 'Please try again.',
  },
  SERVER_ERROR: {
    title: 'Server Error',
    message: 'Our servers are experiencing issues.',
    isRetryable: true,
    suggestedAction: 'Please try again in a few moments.',
  },
};

/**
 * Get network error message
 *
 * @param type - The type of network error
 * @returns The error message configuration
 */
export function getNetworkErrorMessage(
  type: keyof typeof NETWORK_ERROR_MESSAGES
): ErrorMessageConfig {
  return NETWORK_ERROR_MESSAGES[type];
}

// ============================================================================
// Session Expiry Utilities (Task 37.4)
// ============================================================================

/** Session TTL in milliseconds (24 hours) */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Check if a session has expired based on its updatedAt timestamp
 *
 * @param updatedAt - The last update timestamp of the session
 * @returns Whether the session has expired
 */
export function isSessionExpired(updatedAt: Date | string): boolean {
  const lastUpdate = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const now = new Date();
  const elapsed = now.getTime() - lastUpdate.getTime();
  return elapsed > SESSION_TTL_MS;
}

/**
 * Get the remaining time until session expiry
 *
 * @param updatedAt - The last update timestamp of the session
 * @returns Remaining time in milliseconds, or 0 if expired
 */
export function getSessionTimeRemaining(updatedAt: Date | string): number {
  const lastUpdate = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const now = new Date();
  const elapsed = now.getTime() - lastUpdate.getTime();
  const remaining = SESSION_TTL_MS - elapsed;
  return Math.max(0, remaining);
}

/**
 * Format remaining time as a human-readable string
 *
 * @param remainingMs - Remaining time in milliseconds
 * @returns Human-readable time string (e.g., "23 hours", "45 minutes")
 */
export function formatTimeRemaining(remainingMs: number): string {
  if (remainingMs <= 0) {
    return 'expired';
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
