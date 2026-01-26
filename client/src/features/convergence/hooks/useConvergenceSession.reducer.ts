import type { ConvergenceStep, DimensionType, GeneratedImage } from '../types';
import { MAX_FINAL_FRAME_REGENERATIONS } from '../types';
import type { ConvergenceAction, ConvergenceState } from './useConvergenceSession.types';

import {
  getPreviousStep,
  getStepOrder,
  dimensionToStep,
  stepToDimension,
} from '../utils/helpers';
import { getOptionsForDimension } from './useConvergenceSession.options';
import { initialState } from './useConvergenceSession.state';

// ============================================================================
// Reducer (Task 17.3)
// ============================================================================

/**
 * Convergence reducer handling all state transitions
 * Requirement 9.1: Manage all convergence state using useReducer pattern
 */
export function convergenceReducer(
  state: ConvergenceState,
  action: ConvergenceAction
): ConvergenceState {
  switch (action.type) {
    // ========================================================================
    // Session Lifecycle Actions (Task 17.3.1)
    // ========================================================================

    case 'SET_INTENT':
      return {
        ...state,
        intent: action.payload,
        error: null,
      };

    case 'SET_ABORT_CONTROLLER':
      return {
        ...state,
        abortController: action.payload,
      };

    case 'START_SESSION_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'startSession',
        error: null,
      };

    case 'START_SESSION_SUCCESS':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        step: 'starting_point',
        direction: null,
        lockedDimensions: [],
        startingPointMode: null,
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        finalFrameUrl: null,
        uploadedImageUrl: null,
        finalFrameRegenerations: 0,
        depthMapUrl: null,
        cameraPaths: [],
        selectedCameraMotion: null,
        cameraMotionFallbackMode: false,
        subjectMotion: '',
        subjectMotionVideoUrl: null,
        subjectMotionInputMode: null,
        subjectMotionStartImageUrl: null,
        finalPrompt: null,
        regenerationCounts: new Map(),
        imageHistory: new Map(),
        pendingResumeSession: null,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
        focusedOptionIndex: 0,
      };

    case 'START_SESSION_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    // ========================================================================
    // Starting Point Actions
    // ========================================================================

    case 'SET_STARTING_POINT_REQUEST':
      return {
        ...state,
        startingPointMode: action.payload,
        isLoading: true,
        loadingOperation: 'setStartingPoint',
        error: null,
      };

    case 'SET_STARTING_POINT_SUCCESS': {
      const { mode, nextStep, finalFrameUrl, images, options } = action.payload;
      const nextImageHistory = new Map<DimensionType | 'direction', GeneratedImage[]>();

      if (images && images.length > 0) {
        nextImageHistory.set('direction', images);
      }

      return {
        ...state,
        startingPointMode: mode,
        step: nextStep,
        direction: null,
        lockedDimensions: [],
        currentImages: images ?? [],
        currentOptions: options ?? [],
        imageHistory: nextImageHistory,
        regenerationCounts: new Map(),
        finalFrameUrl: finalFrameUrl ?? null,
        uploadedImageUrl: mode === 'upload' ? finalFrameUrl ?? null : null,
        finalFrameRegenerations: 0,
        depthMapUrl: null,
        cameraPaths: [],
        selectedCameraMotion: null,
        cameraMotionFallbackMode: false,
        subjectMotion: '',
        subjectMotionVideoUrl: null,
        subjectMotionInputMode: null,
        subjectMotionStartImageUrl: null,
        finalPrompt: null,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
        focusedOptionIndex: 0,
      };
    }

    case 'SET_STARTING_POINT_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    // ========================================================================
    // Select Option Actions (Task 17.3.2)
    // ========================================================================

    case 'SELECT_OPTION_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'selectOption',
        error: null,
      };

    case 'SELECT_OPTION_SUCCESS': {
      const { images, lockedDimensions, currentDimension, options, direction } = action.payload;

      // Determine the next step based on currentDimension
      let nextStep: ConvergenceStep;
      if (currentDimension === 'camera_motion') {
        nextStep = 'camera_motion';
      } else if (currentDimension === 'subject_motion') {
        nextStep = 'subject_motion';
      } else if (currentDimension === 'final_frame') {
        nextStep = 'final_frame';
      } else {
        nextStep = dimensionToStep(currentDimension);
      }

      // Update image history for the new dimension
      const newImageHistory = new Map(state.imageHistory);
      // Only update history for dimension steps, not subject_motion
      if (
        currentDimension !== 'subject_motion' &&
        currentDimension !== 'camera_motion' &&
        currentDimension !== 'final_frame'
      ) {
        newImageHistory.set(currentDimension as DimensionType | 'direction', images);
      }

      return {
        ...state,
        // Update direction if provided (Task 17.3.2 - direction state update)
        direction: direction ?? state.direction,
        step: nextStep,
        lockedDimensions,
        currentImages: images,
        currentOptions: options ?? [],
        imageHistory: newImageHistory,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
        focusedOptionIndex: 0,
      };
    }

    case 'SELECT_OPTION_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    case 'RESTORE_CACHED_IMAGES':
      return {
        ...state,
        step: dimensionToStep(action.payload.dimension),
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        focusedOptionIndex: 0,
      };

    // ========================================================================
    // Regenerate Actions
    // ========================================================================

    case 'REGENERATE_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'regenerate',
        error: null,
      };

    case 'REGENERATE_SUCCESS': {
      const { images, remainingRegenerations, dimension } = action.payload;
      const newRegenerationCounts = new Map(state.regenerationCounts);
      const currentCount = newRegenerationCounts.get(dimension) ?? 0;
      newRegenerationCounts.set(dimension, currentCount + 1);

      // Update image history
      const newImageHistory = new Map(state.imageHistory);
      newImageHistory.set(dimension, images);

      return {
        ...state,
        currentImages: images,
        regenerationCounts: newRegenerationCounts,
        imageHistory: newImageHistory,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
      };
    }

    case 'REGENERATE_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    // ========================================================================
    // Final Frame Actions
    // ========================================================================

    case 'GENERATE_FINAL_FRAME_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'generateFinalFrame',
        error: null,
      };

    case 'GENERATE_FINAL_FRAME_SUCCESS': {
      const usedRegenerations =
        MAX_FINAL_FRAME_REGENERATIONS - action.payload.remainingRegenerations;

      return {
        ...state,
        finalFrameUrl: action.payload.finalFrameUrl,
        finalFrameRegenerations: Math.max(0, usedRegenerations),
        step: 'final_frame',
        isLoading: false,
        loadingOperation: null,
        abortController: null,
      };
    }

    case 'GENERATE_FINAL_FRAME_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    case 'REGENERATE_FINAL_FRAME_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'regenerateFinalFrame',
        error: null,
      };

    case 'REGENERATE_FINAL_FRAME_SUCCESS': {
      const usedRegenerations =
        MAX_FINAL_FRAME_REGENERATIONS - action.payload.remainingRegenerations;

      return {
        ...state,
        finalFrameUrl: action.payload.finalFrameUrl,
        finalFrameRegenerations: Math.max(0, usedRegenerations),
        step: 'final_frame',
        isLoading: false,
        loadingOperation: null,
        abortController: null,
      };
    }

    case 'REGENERATE_FINAL_FRAME_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    case 'CONFIRM_FINAL_FRAME':
      return {
        ...state,
        step: 'camera_motion',
        depthMapUrl: null,
        cameraPaths: [],
        selectedCameraMotion: null,
        cameraMotionFallbackMode: false,
      };

    // ========================================================================
    // Camera Motion Actions
    // ========================================================================

    case 'GENERATE_CAMERA_MOTION_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'depthEstimation',
        error: null,
      };

    case 'GENERATE_CAMERA_MOTION_SUCCESS':
      return {
        ...state,
        depthMapUrl: action.payload.depthMapUrl,
        cameraPaths: action.payload.cameraPaths,
        cameraMotionFallbackMode: action.payload.fallbackMode,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
        focusedOptionIndex: 0,
      };

    case 'GENERATE_CAMERA_MOTION_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    case 'SELECT_CAMERA_MOTION':
      return {
        ...state,
        selectedCameraMotion: action.payload,
        step: 'subject_motion',
      };

    // ========================================================================
    // Subject Motion Actions
    // ========================================================================

    case 'SET_SUBJECT_MOTION':
      return {
        ...state,
        subjectMotion: action.payload,
      };

    case 'GENERATE_SUBJECT_MOTION_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'videoPreview',
        error: null,
      };

    case 'GENERATE_SUBJECT_MOTION_SUCCESS':
      return {
        ...state,
        subjectMotionVideoUrl: action.payload.videoUrl,
        finalPrompt: action.payload.prompt,
        subjectMotionInputMode: action.payload.inputMode,
        subjectMotionStartImageUrl: action.payload.startImageUrl,
        step: 'preview',
        isLoading: false,
        loadingOperation: null,
        abortController: null,
      };

    case 'GENERATE_SUBJECT_MOTION_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    case 'SKIP_SUBJECT_MOTION':
      return {
        ...state,
        step: 'preview',
        subjectMotion: '',
        subjectMotionInputMode: null,
        subjectMotionStartImageUrl: null,
      };

    // ========================================================================
    // Finalize Actions
    // ========================================================================

    case 'FINALIZE_REQUEST':
      return {
        ...state,
        isLoading: true,
        loadingOperation: 'finalize',
        error: null,
      };

    case 'FINALIZE_SUCCESS':
      return {
        ...state,
        finalPrompt: action.payload.finalPrompt,
        lockedDimensions: action.payload.lockedDimensions,
        step: 'complete',
        isLoading: false,
        loadingOperation: null,
      };

    case 'FINALIZE_FAILURE':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
      };

    // ========================================================================
    // Navigation Actions (Task 17.3.4)
    // ========================================================================

    case 'GO_BACK': {
      const prevStep = getPreviousStep(state.step, state.startingPointMode);
      const isBeforeCameraMotion =
        getStepOrder(prevStep, state.startingPointMode) <
        getStepOrder('camera_motion', state.startingPointMode);
      const shouldResetFinalFrame =
        getStepOrder(prevStep, state.startingPointMode) <
        getStepOrder('final_frame', state.startingPointMode);
      const resetStartingPoint = prevStep === 'starting_point';

      // If going back from a dimension step, unlock the most recent dimension
      const currentDimension = stepToDimension(state.step);
      let newLockedDimensions = state.lockedDimensions;
      let newDirection = state.direction;

      if (currentDimension) {
        // Remove the current dimension from locked dimensions
        newLockedDimensions = state.lockedDimensions.filter(
          (d) => d.type !== currentDimension
        );
      }

      // If going back to direction, clear direction
      if (prevStep === 'direction') {
        newDirection = null;
      }

      // Restore images from history if available
      const prevDimension = stepToDimension(prevStep);
      const cachedImages = prevDimension ? state.imageHistory.get(prevDimension) : undefined;
      const prevOptions =
        prevDimension && prevDimension !== 'camera_motion'
          ? getOptionsForDimension(prevDimension)
          : [];

      return {
        ...state,
        step: prevStep,
        direction: resetStartingPoint ? null : newDirection,
        lockedDimensions: resetStartingPoint ? [] : newLockedDimensions,
        currentImages: resetStartingPoint ? [] : cachedImages ?? state.currentImages,
        currentOptions: resetStartingPoint ? [] : prevOptions,
        selectedCameraMotion: isBeforeCameraMotion ? null : state.selectedCameraMotion,
        depthMapUrl: isBeforeCameraMotion ? null : state.depthMapUrl,
        cameraPaths: isBeforeCameraMotion ? [] : state.cameraPaths,
        cameraMotionFallbackMode: isBeforeCameraMotion ? false : state.cameraMotionFallbackMode,
        startingPointMode: resetStartingPoint ? null : state.startingPointMode,
        finalFrameUrl: shouldResetFinalFrame ? null : state.finalFrameUrl,
        uploadedImageUrl: resetStartingPoint ? null : state.uploadedImageUrl,
        finalFrameRegenerations: shouldResetFinalFrame ? 0 : state.finalFrameRegenerations,
        imageHistory: resetStartingPoint ? new Map() : state.imageHistory,
        regenerationCounts: resetStartingPoint ? new Map() : state.regenerationCounts,
        subjectMotionInputMode: isBeforeCameraMotion ? null : state.subjectMotionInputMode,
        subjectMotionStartImageUrl: isBeforeCameraMotion ? null : state.subjectMotionStartImageUrl,
        focusedOptionIndex: 0,
        error: null,
      };
    }

    case 'JUMP_TO_STEP': {
      const { step, lockedDimensions } = action.payload;
      const isBeforeCameraMotion =
        getStepOrder(step, state.startingPointMode) <
        getStepOrder('camera_motion', state.startingPointMode);
      const shouldResetFinalFrame =
        getStepOrder(step, state.startingPointMode) <
        getStepOrder('final_frame', state.startingPointMode);
      const resetStartingPoint = step === 'starting_point';

      // Restore images from history if available
      const targetDimension = stepToDimension(step);
      const cachedImages = targetDimension ? state.imageHistory.get(targetDimension) : undefined;
      const currentOptions =
        targetDimension && targetDimension !== 'camera_motion'
          ? getOptionsForDimension(targetDimension)
          : [];

      // Clear direction if jumping to direction step
      const newDirection = step === 'direction' ? null : state.direction;

      return {
        ...state,
        step,
        direction: resetStartingPoint ? null : newDirection,
        lockedDimensions: resetStartingPoint ? [] : lockedDimensions,
        currentImages: resetStartingPoint ? [] : cachedImages ?? [],
        currentOptions: resetStartingPoint ? [] : currentOptions,
        selectedCameraMotion: isBeforeCameraMotion ? null : state.selectedCameraMotion,
        depthMapUrl: isBeforeCameraMotion ? null : state.depthMapUrl,
        cameraPaths: isBeforeCameraMotion ? [] : state.cameraPaths,
        cameraMotionFallbackMode: isBeforeCameraMotion ? false : state.cameraMotionFallbackMode,
        startingPointMode: resetStartingPoint ? null : state.startingPointMode,
        finalFrameUrl: shouldResetFinalFrame ? null : state.finalFrameUrl,
        uploadedImageUrl: resetStartingPoint ? null : state.uploadedImageUrl,
        finalFrameRegenerations: shouldResetFinalFrame ? 0 : state.finalFrameRegenerations,
        imageHistory: resetStartingPoint ? new Map() : state.imageHistory,
        regenerationCounts: resetStartingPoint ? new Map() : state.regenerationCounts,
        subjectMotionInputMode: isBeforeCameraMotion ? null : state.subjectMotionInputMode,
        subjectMotionStartImageUrl: isBeforeCameraMotion ? null : state.subjectMotionStartImageUrl,
        focusedOptionIndex: 0,
        error: null,
      };
    }

    // ========================================================================
    // Cancellation Action
    // ========================================================================

    case 'CANCEL_GENERATION':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
        error: null,
      };

    // ========================================================================
    // Resume Session Actions (Task 17.3.3)
    // ========================================================================

    case 'PROMPT_RESUME':
      return {
        ...state,
        pendingResumeSession: action.payload,
      };

    case 'RESUME_SESSION': {
      const session = state.pendingResumeSession;
      if (!session) return state;

      // Convert imageHistory from Record to Map (Task 17.3.3)
      const imageHistoryMap = new Map<DimensionType | 'direction', GeneratedImage[]>();
      if (session.imageHistory) {
        for (const [key, value] of Object.entries(session.imageHistory)) {
          imageHistoryMap.set(key as DimensionType | 'direction', value);
        }
      }

      // Convert regenerationCounts from Record to Map
      const regenerationCountsMap = new Map<DimensionType | 'direction', number>();
      if (session.regenerationCounts) {
        for (const [key, value] of Object.entries(session.regenerationCounts)) {
          regenerationCountsMap.set(key as DimensionType | 'direction', value);
        }
      }

      // Get current images from history based on current step
      const currentDimension = stepToDimension(session.currentStep);
      const currentImages = currentDimension
        ? imageHistoryMap.get(currentDimension) ?? session.generatedImages
        : session.generatedImages;
      const currentOptions =
        currentDimension && currentDimension !== 'camera_motion'
          ? getOptionsForDimension(currentDimension)
          : [];

      return {
        ...state,
        sessionId: session.id,
        step: session.currentStep,
        intent: session.intent,
        direction: session.direction,
        lockedDimensions: session.lockedDimensions,
        startingPointMode: session.startingPointMode,
        currentImages,
        currentOptions,
        finalFrameUrl: session.finalFrameUrl,
        uploadedImageUrl: session.uploadedImageUrl,
        finalFrameRegenerations: session.finalFrameRegenerations,
        depthMapUrl: session.depthMapUrl,
        cameraPaths: [],
        cameraMotionFallbackMode: false,
        selectedCameraMotion: session.cameraMotion,
        subjectMotion: session.subjectMotion ?? '',
        subjectMotionVideoUrl: null,
        subjectMotionInputMode: null,
        subjectMotionStartImageUrl: null,
        finalPrompt: session.finalPrompt,
        imageHistory: imageHistoryMap,
        regenerationCounts: regenerationCountsMap,
        pendingResumeSession: null,
        focusedOptionIndex: 0,
      };
    }

    case 'ABANDON_SESSION':
      return {
        ...initialState,
        pendingResumeSession: null,
      };

    // ========================================================================
    // Credits Modal Actions
    // ========================================================================

    case 'SHOW_CREDITS_MODAL':
      return {
        ...state,
        insufficientCreditsModal: {
          required: action.payload.required,
          available: action.payload.available,
          operation: action.payload.operation,
        },
        isLoading: false,
        loadingOperation: null,
      };

    case 'HIDE_CREDITS_MODAL':
      return {
        ...state,
        insufficientCreditsModal: null,
      };

    // ========================================================================
    // Session Expiry Actions (Task 37.4)
    // ========================================================================

    case 'SHOW_SESSION_EXPIRED_MODAL':
      return {
        ...state,
        sessionExpiredModal: {
          intent: action.payload.intent,
        },
        isLoading: false,
        loadingOperation: null,
      };

    case 'HIDE_SESSION_EXPIRED_MODAL':
      return {
        ...initialState,
        sessionExpiredModal: null,
      };

    // ========================================================================
    // Keyboard Navigation Actions (Task 17.3.5)
    // ========================================================================

    case 'MOVE_FOCUS': {
      const direction = action.payload;
      const optionsCount = state.currentOptions.length || state.cameraPaths.length;

      if (optionsCount === 0) return state;

      // Calculate grid columns based on option count
      const columns = optionsCount <= 9 ? 3 : 4;
      const currentIndex = state.focusedOptionIndex;

      let newIndex = currentIndex;

      switch (direction) {
        case 'ArrowLeft':
          newIndex = currentIndex > 0 ? currentIndex - 1 : optionsCount - 1;
          break;
        case 'ArrowRight':
          newIndex = currentIndex < optionsCount - 1 ? currentIndex + 1 : 0;
          break;
        case 'ArrowUp':
          newIndex = currentIndex - columns >= 0 ? currentIndex - columns : currentIndex;
          break;
        case 'ArrowDown':
          newIndex = currentIndex + columns < optionsCount ? currentIndex + columns : currentIndex;
          break;
      }

      return {
        ...state,
        focusedOptionIndex: newIndex,
      };
    }

    case 'RESET_FOCUS':
      return {
        ...state,
        focusedOptionIndex: 0,
      };

    // ========================================================================
    // Reset Action
    // ========================================================================

    case 'RESET':
      return initialState;

    // ========================================================================
    // Generic Error Action
    // ========================================================================

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'GENERIC_ERROR':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        error: action.payload,
        abortController: null,
      };

    default:
      return state;
  }
}
