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

// Session Store
export { SessionStore, getSessionStore } from './session/SessionStore';
export type { SessionStoreOptions } from './session/SessionStore';

// Session Cleanup Sweeper
export { SessionCleanupSweeper, createSessionCleanupSweeper } from './session/SessionCleanupSweeper';

// Prompt Builder
export {
  DIRECTION_FRAGMENTS,
  MOOD_DIMENSION,
  FRAMING_DIMENSION,
  LIGHTING_DIMENSION,
  CAMERA_MOTION_DIMENSION,
  ALL_DIMENSIONS,
  getDimensionConfig,
  getDimensionOption,
  getDirectionFragments,
  PromptBuilderService,
  getPromptBuilderService,
} from './prompt-builder';

export type {
  PromptBuildOptions,
  PreviewDimension,
  DirectionPromptResult,
} from './prompt-builder';

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
  getGCSStorageService,
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
  ReplicateDepthEstimationService,
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

// Convergence Service (Main Orchestrator)
export type { ConvergenceServiceDeps } from './ConvergenceService';
export {
  ConvergenceService,
  createConvergenceService,
} from './ConvergenceService';
