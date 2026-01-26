import { describe, it, expect, vi } from 'vitest';

import { ConvergenceError } from '../api/convergenceApi';
import { handleApiError } from '../hooks/useConvergenceSession.errorHandler';
import type { ConvergenceSession } from '../types';
import type { ConvergenceAction } from '../hooks/useConvergenceSession.types';

// ============================================================================
// useConvergenceSession.errorHandler
// ============================================================================

describe('handleApiError', () => {
  const createDispatch = () => vi.fn<[ConvergenceAction], void>();

  describe('error handling', () => {
    it('dispatches credits modal details for insufficient credits', () => {
      const dispatch = createDispatch();
      const error = new ConvergenceError('INSUFFICIENT_CREDITS', 'No credits', {
        required: 6,
        available: 2,
      });

      handleApiError(error, dispatch, 'generateFinalFrame');

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SHOW_CREDITS_MODAL',
        payload: {
          required: 6,
          available: 2,
          operation: 'generateFinalFrame',
        },
      });
    });

    it('falls back to a generic error when active session details are invalid', () => {
      const dispatch = createDispatch();
      const error = new ConvergenceError('ACTIVE_SESSION_EXISTS', 'Active session');

      handleApiError(error, dispatch, 'startSession');

      expect(dispatch).toHaveBeenCalledWith({
        type: 'GENERIC_ERROR',
        payload: 'You already have an active session in progress.',
      });
    });

    it('dispatches the session expired modal with intent when provided', () => {
      const dispatch = createDispatch();
      const error = new ConvergenceError('SESSION_EXPIRED', 'Expired', { intent: 'A night skyline' });

      handleApiError(error, dispatch, 'startSession');

      expect(dispatch).toHaveBeenCalledWith({
        type: 'SHOW_SESSION_EXPIRED_MODAL',
        payload: { intent: 'A night skyline' },
      });
    });

    it('dispatches cancel generation for abort errors', () => {
      const dispatch = createDispatch();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      handleApiError(abortError, dispatch, 'selectOption');

      expect(dispatch).toHaveBeenCalledWith({ type: 'CANCEL_GENERATION' });
    });
  });

  describe('edge cases', () => {
    it('prompts a resume flow when an active session is provided', () => {
      const dispatch = createDispatch();
      const session: ConvergenceSession = {
        id: 'session-1',
        userId: 'user-1',
        intent: 'A mountain sunrise',
        aspectRatio: '16:9',
        direction: null,
        lockedDimensions: [],
        currentStep: 'direction',
        generatedImages: [],
        imageHistory: {},
        regenerationCounts: {},
        startingPointMode: null,
        finalFrameUrl: null,
        finalFrameRegenerations: 0,
        uploadedImageUrl: null,
        depthMapUrl: null,
        cameraMotion: null,
        subjectMotion: null,
        finalPrompt: null,
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      const error = new ConvergenceError('ACTIVE_SESSION_EXISTS', 'Active session', {
        existingSession: session,
      });

      handleApiError(error, dispatch, 'startSession');

      expect(dispatch).toHaveBeenCalledWith({ type: 'PROMPT_RESUME', payload: session });
    });
  });

  describe('core behavior', () => {
    it('dispatches generic error messages for non-convergence errors', () => {
      const dispatch = createDispatch();
      const error = new Error('Something went wrong');

      handleApiError(error, dispatch, 'startSession');

      expect(dispatch).toHaveBeenCalledWith({
        type: 'GENERIC_ERROR',
        payload: 'Something went wrong',
      });
    });
  });
});
