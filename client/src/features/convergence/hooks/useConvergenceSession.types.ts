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
