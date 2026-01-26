import type { Dispatch } from 'react';

import { ConvergenceError } from '../api/convergenceApi';
import { getErrorMessage } from '../utils/errorMessages';
import type { ConvergenceSession } from '../types';
import type { ConvergenceAction } from './useConvergenceSession.types';

// ============================================================================
// Error Handling (Task 17.5)
// ============================================================================

type ErrorDetails = Record<string, unknown> | undefined;

function getNumberDetail(details: ErrorDetails, key: string): number {
  const value = details?.[key];
  return typeof value === 'number' ? value : 0;
}

function getStringDetail(details: ErrorDetails, key: string): string {
  const value = details?.[key];
  return typeof value === 'string' ? value : '';
}

function isConvergenceSession(value: unknown): value is ConvergenceSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'currentStep' in value &&
    'intent' in value
  );
}

/**
 * Handle API errors and dispatch appropriate actions
 * Requirement 15.5: Handle INSUFFICIENT_CREDITS and other errors
 * Task 37.1: Use user-friendly error messages for all error codes
 */
export function handleApiError(
  error: Error,
  dispatch: Dispatch<ConvergenceAction>,
  operation: string
): void {
  if (error instanceof ConvergenceError) {
    // Get user-friendly error message
    const errorConfig = getErrorMessage(error.code);

    switch (error.code) {
      case 'INSUFFICIENT_CREDITS':
        dispatch({
          type: 'SHOW_CREDITS_MODAL',
          payload: {
            required: getNumberDetail(error.details, 'required'),
            available: getNumberDetail(error.details, 'available'),
            operation,
          },
        });
        return;

      case 'ACTIVE_SESSION_EXISTS': {
        const existingSession = error.details?.existingSession;
        if (isConvergenceSession(existingSession)) {
          dispatch({
            type: 'PROMPT_RESUME',
            payload: existingSession,
          });
        } else {
          dispatch({ type: 'GENERIC_ERROR', payload: errorConfig.message });
        }
        return;
      }

      case 'REGENERATION_LIMIT_EXCEEDED':
        dispatch({
          type: 'GENERIC_ERROR',
          payload: errorConfig.message,
        });
        return;

      case 'SESSION_NOT_FOUND':
        dispatch({
          type: 'GENERIC_ERROR',
          payload: errorConfig.message,
        });
        return;

      case 'SESSION_EXPIRED':
        // Show session expired modal with the intent if available
        dispatch({
          type: 'SHOW_SESSION_EXPIRED_MODAL',
          payload: {
            intent: getStringDetail(error.details, 'intent'),
          },
        });
        return;

      case 'UNAUTHORIZED':
        dispatch({
          type: 'GENERIC_ERROR',
          payload: errorConfig.message,
        });
        return;

      case 'INCOMPLETE_SESSION':
        dispatch({
          type: 'GENERIC_ERROR',
          payload: errorConfig.message,
        });
        return;

      case 'DEPTH_ESTIMATION_FAILED':
      case 'IMAGE_GENERATION_FAILED':
      case 'VIDEO_GENERATION_FAILED':
        dispatch({
          type: 'GENERIC_ERROR',
          payload: errorConfig.message,
        });
        return;

      default:
        dispatch({ type: 'GENERIC_ERROR', payload: errorConfig.message });
        return;
    }
  }

  // Handle AbortError (request cancellation)
  if (error.name === 'AbortError') {
    dispatch({ type: 'CANCEL_GENERATION' });
    return;
  }

  // Generic error
  dispatch({ type: 'GENERIC_ERROR', payload: error.message || 'An unexpected error occurred.' });
}
