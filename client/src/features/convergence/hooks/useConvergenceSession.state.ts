import type { DimensionType, GeneratedImage } from '../types';
import type { ConvergenceState } from './useConvergenceSession.types';

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
  regenerationCounts: new Map<DimensionType | 'direction', number>(),
  imageHistory: new Map<DimensionType | 'direction', GeneratedImage[]>(),
  abortController: null,
  pendingResumeSession: null,
  insufficientCreditsModal: null,
  sessionExpiredModal: null,
  focusedOptionIndex: 0,
};
