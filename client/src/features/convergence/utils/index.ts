/**
 * Utils barrel exports for the convergence feature
 */

export {
  // Constants
  STEP_ORDER,
  DIMENSION_ORDER,
  // Step navigation
  getStepOrder,
  getNextStep,
  getPreviousStep,
  // Dimension navigation
  getDimensionOrder,
  getNextDimension,
  getPreviousDimension,
  // Step/Dimension conversion
  stepToDimension,
  dimensionToStep,
  // Utility functions
  isDimensionStep,
  getRequiredLockedDimensions,
  getStepLabel,
  isStepBefore,
  isStepAfter,
  getProgressSteps,
} from './helpers';

// Camera motion rendering
export {
  renderCameraMotionFrames,
  createFrameAnimator,
  easeInOutCubic,
  createCleanupFunction,
  type RenderOptions,
  type FrameAnimatorControls,
} from './cameraMotionRenderer';

// Error messages
export {
  ERROR_MESSAGES,
  NETWORK_ERROR_MESSAGES,
  SESSION_TTL_MS,
  getErrorMessage,
  getErrorMessageString,
  isRetryableError,
  getNetworkErrorMessage,
  isSessionExpired,
  getSessionTimeRemaining,
  formatTimeRemaining,
  type ErrorMessageConfig,
} from './errorMessages';
