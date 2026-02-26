/**
 * Visual Convergence Service
 * 
 * This module provides the core infrastructure for the Visual Convergence feature,
 * which transforms PromptCanvas into a visual-first video creation platform.
 * 
 * @module convergence
 */

// Types
export type {
  Direction,
  DimensionType,
  ConvergenceStep,
  StartingPointMode,
  Position3D,
  CameraPath,
  DimensionOption,
  DimensionConfig,
  LockedDimension,
  GeneratedImage,
  SessionStatus,
  ConvergenceSession,
  StartSessionRequest,
  StartSessionResponse,
  SelectOptionRequest,
  SelectOptionResponse,
  RegenerateRequest,
  RegenerateResponse,
  GenerateCameraMotionRequest,
  GenerateCameraMotionResponse,
  SelectCameraMotionRequest,
  GenerateSubjectMotionRequest,
  GenerateSubjectMotionResponse,
  FinalizeSessionResponse,
  SetStartingPointRequest,
  SetStartingPointResponse,
  GenerateFinalFrameRequest,
  GenerateFinalFrameResponse,
  RegenerateFinalFrameRequest,
  CreditReservation,
  CreditReservationStatus,
} from './types';
export {
  CONVERGENCE_STEPS,
  CREDIT_RESERVATION_STATUSES,
  DIMENSION_TYPES,
  DIRECTIONS,
  STARTING_POINT_MODES,
  SESSION_STATUSES,
} from './types';

// Errors
export { ConvergenceError, isConvergenceError } from './errors';
export type { ConvergenceErrorCode } from './errors';

// Helper functions
export {
  STEP_ORDER,
  DIMENSION_ORDER,
  getStepOrder,
  getNextStep,
  getPreviousStep,
  getDimensionOrder,
  getNextDimension,
  getPreviousDimension,
  stepToDimension,
  dimensionToStep,
  isDimensionStep,
  getRequiredLockedDimensions,
  withRetry,
  sleep,
} from './helpers';

// Constants
export {
  DIRECTION_OPTIONS,
  CONVERGENCE_COSTS,
  DEFAULT_ASPECT_RATIO,
  GENERATION_COSTS,
  CAMERA_PATHS,
  CAMERA_MOTION_DESCRIPTIONS,
  MAX_REGENERATIONS_PER_DIMENSION,
  MAX_FINAL_FRAME_REGENERATIONS,
  PREVIEW_PROVIDER,
  FINAL_FRAME_PROVIDER,
  SESSION_TTL_HOURS,
  SESSION_TTL_MS,
} from './constants';

// Credits Service
export type { CreditsService } from './credits';
export {
  FirestoreCreditsService,
  getCreditsService,
  setCreditsService,
  withCreditReservation,
  checkCredits,
  getCreditBalance,
} from './credits';

// Storage Service
export type { StorageService } from './storage';
export {
  GCSStorageService,
  createGCSStorageService,
} from './storage';

// Depth Estimation Service
export type {
  DepthEstimationService,
  DepthEstimationServiceOptions,
  DepthEstimationProvider,
  FalDepthResponse,
} from './depth';
export {
  FalDepthEstimationService,
  createDepthEstimationService,
  createDepthEstimationServiceForUser,
} from './depth';

// Video Preview Service
export type { VideoPreviewService, VideoPreviewOptions, VideoPreviewServiceOptions } from './video-preview';
export {
  ReplicateVideoPreviewService,
  createVideoPreviewService,
  createVideoPreviewServiceForUser,
} from './video-preview';
