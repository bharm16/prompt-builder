/**
 * useConvergenceSession Hook
 *
 * State management for the Visual Convergence flow using useReducer pattern.
 * Manages all convergence state including session lifecycle, dimension selection,
 * camera motion, subject motion, and navigation.
 *
 * Requirements:
 * - 9.1: Manage all convergence state using useReducer pattern
 * - 9.2-9.8: Track loading status, errors, session state, and image history
 * - 10.5: Support request cancellation via AbortController
 * - 12.5-12.6: Support keyboard navigation with focus tracking
 * - 13.1-13.7: Support back navigation and image restoration
 */

import { useReducer, useCallback, useMemo } from 'react';
import {
  convergenceApi,
  ConvergenceError,
} from '../api/convergenceApi';
import {
  getNextStep,
  getPreviousStep,
  getStepOrder,
  dimensionToStep,
  stepToDimension,
} from '../utils/helpers';
import { getErrorMessage } from '../utils/errorMessages';
import type {
  ConvergenceStep,
  Direction,
  DimensionType,
  LockedDimension,
  GeneratedImage,
  CameraPath,
  LoadingOperation,
  ConvergenceSession,
  InsufficientCreditsModalState,
  SelectionOption,
  FinalizeSessionResponse,
} from '../types';

// ============================================================================
// State Interface (Task 17.1)
// ============================================================================

/**
 * Complete state interface for the convergence session
 * Requirement 9.4: Track all session state
 */
export interface ConvergenceState {
  // Session identification
  sessionId: string | null;

  // Flow state
  step: ConvergenceStep;
  intent: string;
  direction: Direction | null;
  lockedDimensions: LockedDimension[];

  // Current dimension state
  currentImages: GeneratedImage[];
  currentOptions: SelectionOption[];

  // Camera motion state
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  selectedCameraMotion: string | null;
  /** Fallback mode for depth estimation failure (Requirement 5.5) - Task 17.1.4 */
  cameraMotionFallbackMode: boolean;

  // Subject motion state
  subjectMotion: string;
  subjectMotionVideoUrl: string | null;

  // Final state
  finalPrompt: string | null;

  // Loading and error state (Requirement 9.7)
  isLoading: boolean;
  loadingOperation: LoadingOperation;
  error: string | null;

  // Regeneration tracking (Requirement 9.4)
  regenerationCounts: Map<DimensionType | 'direction', number>;

  // Image history for back navigation (Requirement 9.8)
  imageHistory: Map<DimensionType | 'direction', GeneratedImage[]>;

  /** AbortController for cancellation support (Requirement 10.5) - Task 17.1.1 */
  abortController: AbortController | null;

  /** Resume prompt state (Requirement 1.6) - Task 17.1.3 */
  pendingResumeSession: ConvergenceSession | null;

  /** Insufficient credits modal state (Requirement 15.5) - Task 17.1.2 */
  insufficientCreditsModal: InsufficientCreditsModalState | null;

  /** Session expired modal state (Task 37.4) */
  sessionExpiredModal: { intent: string } | null;

  /** Focused option for keyboard navigation (Requirement 12.5-12.6) - Task 17.1.5 */
  focusedOptionIndex: number;
}

// ============================================================================
// Action Types (Task 17.2)
// ============================================================================

/**
 * Union type of all convergence actions
 */
export type ConvergenceAction =
  // Session lifecycle actions (Task 17.3.1)
  | { type: 'SET_INTENT'; payload: string }
  | { type: 'SET_ABORT_CONTROLLER'; payload: AbortController }
  | { type: 'START_SESSION_REQUEST' }
  | {
      type: 'START_SESSION_SUCCESS';
      payload: {
        sessionId: string;
        images: GeneratedImage[];
        options: SelectionOption[];
      };
    }
  | { type: 'START_SESSION_FAILURE'; payload: string }
  // Select option actions (Task 17.3.2)
  | { type: 'SELECT_OPTION_REQUEST' }
  | {
      type: 'SELECT_OPTION_SUCCESS';
      payload: {
        images: GeneratedImage[];
        lockedDimensions: LockedDimension[];
        currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
        options?: SelectionOption[];
        direction?: Direction;
      };
    }
  | { type: 'SELECT_OPTION_FAILURE'; payload: string }
  // Restore cached images (Requirement 13.5)
  | {
      type: 'RESTORE_CACHED_IMAGES';
      payload: {
        dimension: DimensionType | 'direction';
        images: GeneratedImage[];
        options: SelectionOption[];
      };
    }
  // Regenerate actions
  | { type: 'REGENERATE_REQUEST' }
  | {
      type: 'REGENERATE_SUCCESS';
      payload: {
        images: GeneratedImage[];
        remainingRegenerations: number;
        dimension: DimensionType | 'direction';
      };
    }
  | { type: 'REGENERATE_FAILURE'; payload: string }
  // Camera motion actions
  | { type: 'GENERATE_CAMERA_MOTION_REQUEST' }
  | {
      type: 'GENERATE_CAMERA_MOTION_SUCCESS';
      payload: {
        depthMapUrl: string | null;
        cameraPaths: CameraPath[];
        fallbackMode: boolean;
      };
    }
  | { type: 'GENERATE_CAMERA_MOTION_FAILURE'; payload: string }
  | { type: 'SELECT_CAMERA_MOTION'; payload: string }
  // Subject motion actions
  | { type: 'SET_SUBJECT_MOTION'; payload: string }
  | { type: 'GENERATE_SUBJECT_MOTION_REQUEST' }
  | {
      type: 'GENERATE_SUBJECT_MOTION_SUCCESS';
      payload: {
        videoUrl: string;
        prompt: string;
      };
    }
  | { type: 'GENERATE_SUBJECT_MOTION_FAILURE'; payload: string }
  | { type: 'SKIP_SUBJECT_MOTION' }
  // Finalize actions
  | { type: 'FINALIZE_REQUEST' }
  | {
      type: 'FINALIZE_SUCCESS';
      payload: {
        finalPrompt: string;
        lockedDimensions: LockedDimension[];
      };
    }
  | { type: 'FINALIZE_FAILURE'; payload: string }
  // Navigation actions (Task 17.3.4)
  | { type: 'GO_BACK' }
  | {
      type: 'JUMP_TO_STEP';
      payload: {
        step: ConvergenceStep;
        lockedDimensions: LockedDimension[];
      };
    }
  // Cancellation action
  | { type: 'CANCEL_GENERATION' }
  // Resume session actions (Task 17.3.3)
  | { type: 'PROMPT_RESUME'; payload: ConvergenceSession }
  | { type: 'RESUME_SESSION' }
  | { type: 'ABANDON_SESSION' }
  // Credits modal actions
  | {
      type: 'SHOW_CREDITS_MODAL';
      payload: {
        required: number;
        available: number;
        operation: string;
      };
    }
  | { type: 'HIDE_CREDITS_MODAL' }
  // Session expiry actions (Task 37.4)
  | { type: 'SHOW_SESSION_EXPIRED_MODAL'; payload: { intent: string } }
  | { type: 'HIDE_SESSION_EXPIRED_MODAL' }
  // Keyboard navigation actions (Task 17.3.5)
  | { type: 'MOVE_FOCUS'; payload: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' }
  | { type: 'RESET_FOCUS' }
  // Reset action
  | { type: 'RESET' }
  // Generic error action
  | { type: 'GENERIC_ERROR'; payload: string };

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial state for the convergence session
 */
export const initialState: ConvergenceState = {
  sessionId: null,
  step: 'intent',
  intent: '',
  direction: null,
  lockedDimensions: [],
  currentImages: [],
  currentOptions: [],
  depthMapUrl: null,
  cameraPaths: [],
  selectedCameraMotion: null,
  cameraMotionFallbackMode: false,
  subjectMotion: '',
  subjectMotionVideoUrl: null,
  finalPrompt: null,
  isLoading: false,
  loadingOperation: null,
  error: null,
  regenerationCounts: new Map(),
  imageHistory: new Map(),
  abortController: null,
  pendingResumeSession: null,
  insufficientCreditsModal: null,
  sessionExpiredModal: null,
  focusedOptionIndex: 0,
};

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
        step: 'direction',
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        imageHistory: new Map([['direction', action.payload.images]]),
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
      } else {
        nextStep = dimensionToStep(currentDimension);
      }

      // Update image history for the new dimension
      const newImageHistory = new Map(state.imageHistory);
      // Only update history for dimension steps, not subject_motion
      if (currentDimension !== 'subject_motion' && currentDimension !== 'camera_motion') {
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
      const prevStep = getPreviousStep(state.step);

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

      return {
        ...state,
        step: prevStep,
        direction: newDirection,
        lockedDimensions: newLockedDimensions,
        currentImages: cachedImages ?? state.currentImages,
        selectedCameraMotion: prevStep === 'camera_motion' ? null : state.selectedCameraMotion,
        focusedOptionIndex: 0,
        error: null,
      };
    }

    case 'JUMP_TO_STEP': {
      const { step, lockedDimensions } = action.payload;

      // Restore images from history if available
      const targetDimension = stepToDimension(step);
      const cachedImages = targetDimension ? state.imageHistory.get(targetDimension) : undefined;

      // Clear direction if jumping to direction step
      const newDirection = step === 'direction' ? null : state.direction;

      return {
        ...state,
        step,
        direction: newDirection,
        lockedDimensions,
        currentImages: cachedImages ?? [],
        selectedCameraMotion: getStepOrder(step) <= getStepOrder('camera_motion') ? null : state.selectedCameraMotion,
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

      return {
        ...state,
        sessionId: session.id,
        step: session.currentStep,
        intent: session.intent,
        direction: session.direction,
        lockedDimensions: session.lockedDimensions,
        currentImages,
        depthMapUrl: session.depthMapUrl,
        selectedCameraMotion: session.cameraMotion,
        subjectMotion: session.subjectMotion ?? '',
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

      // Calculate grid columns based on step (4 for images, 6 for camera motion)
      const columns = state.step === 'camera_motion' ? 3 : 4;
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


// ============================================================================
// Error Handling (Task 17.5)
// ============================================================================

/**
 * Handle API errors and dispatch appropriate actions
 * Requirement 15.5: Handle INSUFFICIENT_CREDITS and other errors
 * Task 37.1: Use user-friendly error messages for all error codes
 */
function handleApiError(
  error: Error,
  dispatch: React.Dispatch<ConvergenceAction>,
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
            required: (error.details?.required as number) ?? 0,
            available: (error.details?.available as number) ?? 0,
            operation,
          },
        });
        return;

      case 'ACTIVE_SESSION_EXISTS':
        // The existing session should be in the error details
        if (error.details?.existingSession) {
          dispatch({
            type: 'PROMPT_RESUME',
            payload: error.details.existingSession as ConvergenceSession,
          });
        } else {
          dispatch({ type: 'GENERIC_ERROR', payload: errorConfig.message });
        }
        return;

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
            intent: (error.details?.intent as string) ?? '',
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

// ============================================================================
// Actions Interface
// ============================================================================

/**
 * Actions interface for the convergence session
 */
export interface ConvergenceActions {
  /** Set the intent text */
  setIntent: (intent: string) => void;
  /** Start a new convergence session */
  startSession: (intent: string, aspectRatio?: string) => Promise<void>;
  /** Select an option for a dimension */
  selectOption: (dimension: DimensionType | 'direction', optionId: string) => Promise<void>;
  /** Regenerate options for the current dimension */
  regenerate: () => Promise<void>;
  /** Go back to the previous step */
  goBack: () => void;
  /** Jump to a specific step */
  jumpToStep: (step: ConvergenceStep) => void;
  /** Select a camera motion */
  selectCameraMotion: (motionId: string) => Promise<void>;
  /** Set the subject motion text */
  setSubjectMotion: (motion: string) => void;
  /** Generate subject motion preview video */
  generateSubjectMotionPreview: () => Promise<void>;
  /** Skip subject motion and proceed to preview */
  skipSubjectMotion: () => void;
  /** Finalize the session */
  finalize: () => Promise<FinalizeSessionResponse | null>;
  /** Reset the session to initial state */
  reset: () => void;
  /** Cancel the current generation */
  cancelGeneration: () => void;
  /** Resume the pending session */
  resumeSession: () => void;
  /** Abandon the pending session and start fresh */
  abandonAndStartFresh: () => Promise<void>;
  /** Move focus for keyboard navigation */
  moveFocus: (direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') => void;
  /** Select the currently focused option */
  selectFocused: () => void;
  /** Hide the insufficient credits modal */
  hideCreditsModal: () => void;
  /** Hide the session expired modal and reset state (Task 37.4) */
  hideSessionExpiredModal: () => void;
}

// ============================================================================
// Hook Return Type
// ============================================================================

/**
 * Return type for the useConvergenceSession hook
 */
export interface UseConvergenceSessionReturn {
  state: ConvergenceState;
  actions: ConvergenceActions;
}

// ============================================================================
// Hook Implementation (Task 17.4)
// ============================================================================

/**
 * useConvergenceSession Hook
 *
 * Manages all convergence flow state using useReducer pattern.
 * Provides state and action creators for the convergence flow.
 *
 * @returns Object containing state and actions
 *
 * @example
 * ```tsx
 * function ConvergenceFlow() {
 *   const { state, actions } = useConvergenceSession();
 *
 *   const handleStart = async () => {
 *     await actions.startSession('A cat walking in the rain');
 *   };
 *
 *   return (
 *     <div>
 *       {state.step === 'intent' && (
 *         <IntentInput onSubmit={handleStart} />
 *       )}
 *       {state.step === 'direction' && (
 *         <DirectionFork
 *           images={state.currentImages}
 *           onSelect={(id) => actions.selectOption('direction', id)}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useConvergenceSession(): UseConvergenceSessionReturn {
  const [state, dispatch] = useReducer(convergenceReducer, initialState);

  // ========================================================================
  // Action Creators (Task 17.4)
  // ========================================================================

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
      if ((error as Error).name === 'AbortError') {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      handleApiError(error as Error, dispatch, 'startSession');
      dispatch({ type: 'START_SESSION_FAILURE', payload: (error as Error).message });
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
        const nextDimension = getNextDimensionForRestore(dimension);
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
        if ((error as Error).name === 'AbortError') {
          dispatch({ type: 'CANCEL_GENERATION' });
          return;
        }
        handleApiError(error as Error, dispatch, 'selectOption');
        dispatch({ type: 'SELECT_OPTION_FAILURE', payload: (error as Error).message });
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
      if ((error as Error).name === 'AbortError') {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      handleApiError(error as Error, dispatch, 'regenerate');
      dispatch({ type: 'REGENERATE_FAILURE', payload: (error as Error).message });
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
        handleApiError(error as Error, dispatch, 'selectCameraMotion');
      }
    },
    [state.sessionId]
  );

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
      if ((error as Error).name === 'AbortError') {
        dispatch({ type: 'CANCEL_GENERATION' });
        return;
      }
      handleApiError(error as Error, dispatch, 'generateSubjectMotion');
      dispatch({ type: 'GENERATE_SUBJECT_MOTION_FAILURE', payload: (error as Error).message });
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
      handleApiError(error as Error, dispatch, 'finalize');
      dispatch({ type: 'FINALIZE_FAILURE', payload: (error as Error).message });
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
   * Abandon the pending session and start fresh (Task 17.4.5)
   */
  const abandonAndStartFresh = useCallback(async (): Promise<void> => {
    // TODO: Call API to abandon the session and clean up resources
    // For now, just clear the local state
    dispatch({ type: 'ABANDON_SESSION' });
  }, []);

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
  }, [state.step, state.cameraPaths, state.currentOptions, state.focusedOptionIndex, selectCameraMotion, selectOption]);

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
      setSubjectMotion,
      generateSubjectMotionPreview,
      skipSubjectMotion,
      finalize,
      reset,
      cancelGeneration,
      resumeSession,
      abandonAndStartFresh,
      moveFocus,
      selectFocused,
      hideCreditsModal,
      hideSessionExpiredModal,
    }),
    [
      setIntent,
      startSession,
      selectOption,
      regenerate,
      goBack,
      jumpToStep,
      selectCameraMotion,
      setSubjectMotion,
      generateSubjectMotionPreview,
      skipSubjectMotion,
      finalize,
      reset,
      cancelGeneration,
      resumeSession,
      abandonAndStartFresh,
      moveFocus,
      selectFocused,
      hideCreditsModal,
      hideSessionExpiredModal,
    ]
  );

  return { state, actions };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the next dimension for image restoration
 */
function getNextDimensionForRestore(
  dimension: DimensionType | 'direction'
): DimensionType | 'direction' | null {
  const flow: Record<string, DimensionType> = {
    direction: 'mood',
    mood: 'framing',
    framing: 'lighting',
    lighting: 'camera_motion',
  };
  return flow[dimension] || null;
}

/**
 * Get options for a dimension (placeholder - should be replaced with actual dimension config)
 */
function getOptionsForDimension(dimension: DimensionType | 'direction'): SelectionOption[] {
  // This is a placeholder - in a real implementation, this would come from
  // dimension configuration or be stored in the image history
  const dimensionOptions: Record<string, SelectionOption[]> = {
    direction: [
      { id: 'cinematic', label: 'Cinematic' },
      { id: 'social', label: 'Social' },
      { id: 'artistic', label: 'Artistic' },
      { id: 'documentary', label: 'Documentary' },
    ],
    mood: [
      { id: 'dramatic', label: 'Dramatic' },
      { id: 'peaceful', label: 'Peaceful' },
      { id: 'mysterious', label: 'Mysterious' },
      { id: 'nostalgic', label: 'Nostalgic' },
    ],
    framing: [
      { id: 'wide', label: 'Wide Shot' },
      { id: 'medium', label: 'Medium Shot' },
      { id: 'closeup', label: 'Close-up' },
      { id: 'extreme_closeup', label: 'Extreme Close-up' },
    ],
    lighting: [
      { id: 'golden_hour', label: 'Golden Hour' },
      { id: 'blue_hour', label: 'Blue Hour' },
      { id: 'high_key', label: 'High Key' },
      { id: 'low_key', label: 'Low Key' },
    ],
    camera_motion: [
      { id: 'static', label: 'Static' },
      { id: 'pan_left', label: 'Pan Left' },
      { id: 'pan_right', label: 'Pan Right' },
      { id: 'push_in', label: 'Push In' },
      { id: 'pull_back', label: 'Pull Back' },
      { id: 'crane_up', label: 'Crane Up' },
    ],
  };

  return dimensionOptions[dimension] ?? [];
}

export default useConvergenceSession;
