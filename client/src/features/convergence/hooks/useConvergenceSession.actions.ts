import { useCallback, useMemo } from 'react';
import type { Dispatch } from 'react';

import { logger } from '@/services/LoggingService';

import type {
  ConvergenceStep,
  ConvergenceSession,
  DimensionType,
  Direction,
  GeneratedImage,
  LockedDimension,
  SelectionOption,
  FinalizeSessionResponse,
} from '../types';
import type {
  ConvergenceAction,
  ConvergenceActions,
  ConvergenceState,
} from './useConvergenceSession.types';
import { convergenceApi } from '../api/convergenceApi';
import {
  getNextDimension,
  getStepOrder,
  dimensionToStep,
  stepToDimension,
} from '../utils/helpers';
import { handleApiError } from './useConvergenceSession.errorHandler';
import { getOptionsForDimension } from './useConvergenceSession.options';

// ============================================================================
// Action Creators (Task 17.4)
// ============================================================================

const log = logger.child('useConvergenceSessionActions');

export function useConvergenceSessionActions(
  state: ConvergenceState,
  dispatch: Dispatch<ConvergenceAction>
): ConvergenceActions {
  /**
   * Set the intent text
   */
  const setIntent = useCallback((intent: string): void => {
    dispatch({ type: 'SET_INTENT', payload: intent });
  }, []);

  /**
   * Start a new convergence session (Task 17.4.1)
   * Creates AbortController for cancellation support
   */
  const startSession = useCallback(async (intent: string, aspectRatio?: string): Promise<void> => {
    const controller = new AbortController();
    dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
    dispatch({ type: 'START_SESSION_REQUEST' });

    try {
      const result = await convergenceApi.startSession(intent, aspectRatio, controller.signal);
      dispatch({
        type: 'START_SESSION_SUCCESS',
        payload: {
          sessionId: result.sessionId,
          images: result.images,
          options: result.options.map((o) => ({ id: o.id, label: o.label })),
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      const normalizedError = toError(error);
      handleApiError(normalizedError, dispatch, 'startSession');
      dispatch({ type: 'START_SESSION_FAILURE', payload: normalizedError.message });
    }
  }, []);

  /**
   * Select an option for a dimension (Task 17.4.2)
   * Handles direction check fix: check state.direction for direction, lockedDimensions for others
   */
  const selectOption = useCallback(
    async (dimension: DimensionType | 'direction', optionId: string): Promise<void> => {
      if (!state.sessionId) {
        dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
        return;
      }

      // Check if same option is being selected (Requirement 13.5, 15.8)
      // Task 17.4.2: Check state.direction for direction, lockedDimensions for others
      let previousSelection: string | undefined;

      if (dimension === 'direction') {
        // For direction, check state.direction
        previousSelection = state.direction ?? undefined;
      } else {
        // For other dimensions, check lockedDimensions
        const lockedDim = state.lockedDimensions.find((d) => d.type === dimension);
        previousSelection = lockedDim?.optionId;
      }

      // Same option selected - restore from cache, no API call, no credits charged
      if (previousSelection === optionId) {
        const nextDimension = getNextDimension(dimension);
        if (nextDimension) {
          const cachedImages = state.imageHistory.get(nextDimension);
          if (cachedImages && cachedImages.length > 0) {
            // Get options for the cached dimension
            const options = getOptionsForDimension(nextDimension);
            dispatch({
              type: 'RESTORE_CACHED_IMAGES',
              payload: {
                dimension: nextDimension,
                images: cachedImages,
                options,
              },
            });
            return;
          }
        }
      }

      // Different option - call API
      const controller = new AbortController();
      dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
      dispatch({ type: 'SELECT_OPTION_REQUEST' });

      try {
        const result = await convergenceApi.selectOption(
          state.sessionId,
          dimension,
          optionId,
          controller.signal
        );

        // Map options to SelectionOption type
        const mappedOptions: SelectionOption[] | undefined = result.options
          ? result.options.map((o) => ({ id: o.id, label: o.label }))
          : undefined;

        // Build payload with conditional options to satisfy exactOptionalPropertyTypes
        const payload: {
          images: GeneratedImage[];
          lockedDimensions: LockedDimension[];
          currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
          options?: SelectionOption[];
          direction?: Direction;
        } = {
          images: result.images,
          lockedDimensions: result.lockedDimensions,
          currentDimension: result.currentDimension,
        };

        if (mappedOptions) {
          payload.options = mappedOptions;
        }
        if (result.direction) {
          payload.direction = result.direction;
        }

        dispatch({
          type: 'SELECT_OPTION_SUCCESS',
          payload,
        });
      } catch (error) {
        if (isAbortError(error)) {
          dispatch({ type: 'CANCEL_GENERATION' });
          return;
        }
        const normalizedError = toError(error);
        handleApiError(normalizedError, dispatch, 'selectOption');
        dispatch({ type: 'SELECT_OPTION_FAILURE', payload: normalizedError.message });
      }
    },
    [state.sessionId, state.direction, state.lockedDimensions, state.imageHistory]
  );

  /**
   * Regenerate options for the current dimension (Task 17.4.3)
   */
  const regenerate = useCallback(async (): Promise<void> => {
    if (!state.sessionId) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
      return;
    }

    const currentDimension = stepToDimension(state.step);
    if (!currentDimension) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'Cannot regenerate at this step' });
      return;
    }

    const controller = new AbortController();
    dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
    dispatch({ type: 'REGENERATE_REQUEST' });

    try {
      const result = await convergenceApi.regenerate(
        state.sessionId,
        currentDimension,
        controller.signal
      );
      dispatch({
        type: 'REGENERATE_SUCCESS',
        payload: {
          images: result.images,
          remainingRegenerations: result.remainingRegenerations,
          dimension: currentDimension,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      const normalizedError = toError(error);
      handleApiError(normalizedError, dispatch, 'regenerate');
      dispatch({ type: 'REGENERATE_FAILURE', payload: normalizedError.message });
    }
  }, [state.sessionId, state.step]);

  /**
   * Go back to the previous step (Task 17.4.3)
   */
  const goBack = useCallback((): void => {
    // Cancel any in-flight request (Requirement 13.7)
    state.abortController?.abort();
    dispatch({ type: 'GO_BACK' });
  }, [state.abortController]);

  /**
   * Jump to a specific step (Task 17.4.3)
   */
  const jumpToStep = useCallback(
    (step: ConvergenceStep): void => {
      // Cancel any in-flight request
      state.abortController?.abort();

      // Calculate which dimensions should remain locked
      const stepOrder = getStepOrder(step);
      const newLockedDimensions = state.lockedDimensions.filter((d) => {
        const dimStep = dimensionToStep(d.type);
        return getStepOrder(dimStep) < stepOrder;
      });

      dispatch({
        type: 'JUMP_TO_STEP',
        payload: { step, lockedDimensions: newLockedDimensions },
      });
    },
    [state.abortController, state.lockedDimensions]
  );

  /**
   * Select a camera motion
   */
  const selectCameraMotion = useCallback(
    async (motionId: string): Promise<void> => {
      if (!state.sessionId) {
        dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
        return;
      }

      try {
        await convergenceApi.selectCameraMotion(state.sessionId, motionId);
        dispatch({ type: 'SELECT_CAMERA_MOTION', payload: motionId });
      } catch (error) {
        const normalizedError = toError(error);
        handleApiError(normalizedError, dispatch, 'selectCameraMotion');
      }
    },
    [state.sessionId]
  );

  /**
   * Generate camera motion options and depth map
   */
  const generateCameraMotion = useCallback(async (): Promise<void> => {
    if (!state.sessionId) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
      return;
    }

    const controller = new AbortController();
    dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
    dispatch({ type: 'GENERATE_CAMERA_MOTION_REQUEST' });

    try {
      const result = await convergenceApi.generateCameraMotion(
        state.sessionId,
        controller.signal
      );
      dispatch({
        type: 'GENERATE_CAMERA_MOTION_SUCCESS',
        payload: {
          depthMapUrl: result.depthMapUrl,
          cameraPaths: result.cameraPaths,
          fallbackMode: result.fallbackMode,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      const normalizedError = toError(error);
      handleApiError(normalizedError, dispatch, 'generateCameraMotion');
      dispatch({ type: 'GENERATE_CAMERA_MOTION_FAILURE', payload: normalizedError.message });
    }
  }, [state.sessionId]);

  /**
   * Set the subject motion text
   */
  const setSubjectMotion = useCallback((motion: string): void => {
    dispatch({ type: 'SET_SUBJECT_MOTION', payload: motion });
  }, []);

  /**
   * Generate subject motion preview video
   */
  const generateSubjectMotionPreview = useCallback(async (): Promise<void> => {
    if (!state.sessionId) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
      return;
    }

    if (!state.subjectMotion.trim()) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'Please enter a subject motion description' });
      return;
    }

    const controller = new AbortController();
    dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
    dispatch({ type: 'GENERATE_SUBJECT_MOTION_REQUEST' });

    try {
      const result = await convergenceApi.generateSubjectMotion(
        state.sessionId,
        state.subjectMotion,
        controller.signal
      );
      dispatch({
        type: 'GENERATE_SUBJECT_MOTION_SUCCESS',
        payload: {
          videoUrl: result.videoUrl,
          prompt: result.prompt,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      const normalizedError = toError(error);
      handleApiError(normalizedError, dispatch, 'generateSubjectMotion');
      dispatch({ type: 'GENERATE_SUBJECT_MOTION_FAILURE', payload: normalizedError.message });
    }
  }, [state.sessionId, state.subjectMotion]);

  /**
   * Skip subject motion and proceed to preview
   */
  const skipSubjectMotion = useCallback((): void => {
    dispatch({ type: 'SKIP_SUBJECT_MOTION' });
  }, []);

  /**
   * Finalize the session
   */
  const finalize = useCallback(async (): Promise<FinalizeSessionResponse | null> => {
    if (!state.sessionId) {
      dispatch({ type: 'GENERIC_ERROR', payload: 'No active session' });
      return null;
    }

    dispatch({ type: 'FINALIZE_REQUEST' });

    try {
      const result = await convergenceApi.finalizeSession(state.sessionId);
      dispatch({
        type: 'FINALIZE_SUCCESS',
        payload: {
          finalPrompt: result.finalPrompt,
          lockedDimensions: result.lockedDimensions,
        },
      });
      return result;
    } catch (error) {
      const normalizedError = toError(error);
      handleApiError(normalizedError, dispatch, 'finalize');
      dispatch({ type: 'FINALIZE_FAILURE', payload: normalizedError.message });
      return null;
    }
  }, [state.sessionId]);

  /**
   * Reset the session to initial state
   */
  const reset = useCallback((): void => {
    // Cancel any in-flight request
    state.abortController?.abort();
    dispatch({ type: 'RESET' });
  }, [state.abortController]);

  /**
   * Cancel the current generation (Task 17.4.4)
   */
  const cancelGeneration = useCallback((): void => {
    state.abortController?.abort();
    dispatch({ type: 'CANCEL_GENERATION' });
  }, [state.abortController]);

  /**
   * Resume the pending session (Task 17.4.5)
   */
  const resumeSession = useCallback((): void => {
    dispatch({ type: 'RESUME_SESSION' });
  }, []);

  /**
   * Prompt the user to resume a session
   */
  const promptResume = useCallback((session: ConvergenceSession): void => {
    dispatch({ type: 'PROMPT_RESUME', payload: session });
  }, []);

  /**
   * Abandon the pending session and start fresh (Task 17.4.5)
   * Calls the API to abandon the session and clean up resources
   */
  const abandonAndStartFresh = useCallback(async (): Promise<void> => {
    const pendingSession = state.pendingResumeSession;

    if (pendingSession) {
      try {
        // Call API to abandon the session and delete associated images
        await convergenceApi.abandonSession(pendingSession.id, true);
      } catch (error) {
        // Log error but still clear state - user wants to start fresh
        const normalizedError = toError(error);
        log.error('Failed to abandon session via API', normalizedError, {
          sessionId: pendingSession.id,
        });
      }
    }

    // Clear local state regardless of API success
    dispatch({ type: 'ABANDON_SESSION' });
  }, [state.pendingResumeSession]);

  /**
   * Move focus for keyboard navigation
   */
  const moveFocus = useCallback(
    (direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): void => {
      dispatch({ type: 'MOVE_FOCUS', payload: direction });
    },
    []
  );

  /**
   * Select the currently focused option
   */
  const selectFocused = useCallback((): void => {
    const currentDimension = stepToDimension(state.step);

    if (state.step === 'camera_motion' && state.cameraPaths.length > 0) {
      const focusedPath = state.cameraPaths[state.focusedOptionIndex];
      if (focusedPath) {
        selectCameraMotion(focusedPath.id);
      }
    } else if (currentDimension && state.currentOptions.length > 0) {
      const focusedOption = state.currentOptions[state.focusedOptionIndex];
      if (focusedOption) {
        selectOption(currentDimension, focusedOption.id);
      }
    }
  }, [
    state.step,
    state.cameraPaths,
    state.currentOptions,
    state.focusedOptionIndex,
    selectCameraMotion,
    selectOption,
  ]);

  /**
   * Hide the insufficient credits modal
   */
  const hideCreditsModal = useCallback((): void => {
    dispatch({ type: 'HIDE_CREDITS_MODAL' });
  }, []);

  /**
   * Hide the session expired modal and reset state (Task 37.4)
   */
  const hideSessionExpiredModal = useCallback((): void => {
    dispatch({ type: 'HIDE_SESSION_EXPIRED_MODAL' });
  }, []);

  /**
   * Clear the current error message
   */
  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // ========================================================================
  // Memoized Actions Object
  // ========================================================================

  const actions: ConvergenceActions = useMemo(
    () => ({
      setIntent,
      startSession,
      selectOption,
      regenerate,
      goBack,
      jumpToStep,
      selectCameraMotion,
      generateCameraMotion,
      setSubjectMotion,
      generateSubjectMotionPreview,
      skipSubjectMotion,
      finalize,
      reset,
      cancelGeneration,
      resumeSession,
      promptResume,
      abandonAndStartFresh,
      moveFocus,
      selectFocused,
      hideCreditsModal,
      hideSessionExpiredModal,
      clearError,
    }),
    [
      setIntent,
      startSession,
      selectOption,
      regenerate,
      goBack,
      jumpToStep,
      selectCameraMotion,
      generateCameraMotion,
      setSubjectMotion,
      generateSubjectMotionPreview,
      skipSubjectMotion,
      finalize,
      reset,
      cancelGeneration,
      resumeSession,
      promptResume,
      abandonAndStartFresh,
      moveFocus,
      selectFocused,
      hideCreditsModal,
      hideSessionExpiredModal,
      clearError,
    ]
  );

  return actions;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('An unexpected error occurred.');
}
