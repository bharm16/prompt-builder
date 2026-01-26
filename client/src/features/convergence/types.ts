/**
 * Type definitions for the Visual Convergence feature (Frontend)
 *
 * These types mirror the backend types in server/src/services/convergence/types.ts
 * with additional frontend-specific types for state management and UI.
 */

// ============================================================================
// Core Types (mirrored from backend)
// ============================================================================

/**
 * High-level creative direction that influences all subsequent options
 */
export const DIRECTIONS = ['cinematic', 'social', 'artistic', 'documentary'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * Visual attribute categories that users select from
 */
export const DIMENSION_TYPES = ['mood', 'framing', 'lighting', 'camera_motion'] as const;
export type DimensionType = (typeof DIMENSION_TYPES)[number];

/**
 * Steps in the convergence flow
 */
export const CONVERGENCE_STEPS = [
  'intent',
  'direction',
  'mood',
  'framing',
  'lighting',
  'camera_motion',
  'subject_motion',
  'preview',
  'complete',
] as const;
export type ConvergenceStep = (typeof CONVERGENCE_STEPS)[number];

// ============================================================================
// Camera Motion Types
// ============================================================================

/**
 * 3D position for camera path interpolation
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Predefined 3D camera movement trajectory used for depth-based parallax rendering
 */
export interface CameraPath {
  id: string;
  label: string;
  start: Position3D;
  end: Position3D;
  duration: number;
}

// ============================================================================
// Dimension Configuration Types
// ============================================================================

/**
 * A single option within a dimension with associated prompt fragments
 */
export interface DimensionOption {
  id: string;
  label: string;
  promptFragments: string[];
}

/**
 * Configuration for a dimension including all available options
 */
export interface DimensionConfig {
  type: DimensionType;
  options: DimensionOption[];
}

/**
 * A dimension that has been selected and will influence all subsequent image generations
 */
export interface LockedDimension {
  type: DimensionType;
  optionId: string;
  label: string;
  promptFragments: string[];
}

// ============================================================================
// Generated Asset Types
// ============================================================================

/**
 * A generated image stored in GCS
 */
export interface GeneratedImage {
  id: string;
  url: string; // Signed GCS URL
  dimension: DimensionType | 'direction';
  optionId: string;
  prompt: string;
  generatedAt: Date;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session status
 */
export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * Convergence session data from the backend
 */
export interface ConvergenceSession {
  id: string;
  userId: string;
  intent: string;
  aspectRatio: string;
  direction: Direction | null;
  lockedDimensions: LockedDimension[];
  currentStep: ConvergenceStep;
  generatedImages: GeneratedImage[];
  imageHistory: Record<string, GeneratedImage[]>;
  regenerationCounts: Record<string, number>;
  depthMapUrl: string | null;
  cameraMotion: string | null;
  subjectMotion: string | null;
  finalPrompt: string | null;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to start a new convergence session
 */
export interface StartSessionRequest {
  intent: string;
  aspectRatio?: string;
}

/**
 * Response from starting a new session
 */
export interface StartSessionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: 'direction';
  options: Array<{ id: Direction; label: string }>;
  estimatedCost: number;
}

/**
 * Request to select an option in a dimension
 */
export interface SelectOptionRequest {
  sessionId: string;
  dimension: DimensionType | 'direction';
  optionId: string;
}

/**
 * Response from selecting an option
 */
export interface SelectOptionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
  lockedDimensions: LockedDimension[];
  options?: Array<{ id: string; label: string }>;
  creditsConsumed: number;
  direction?: Direction;
}

/**
 * Request to regenerate options for a dimension
 */
export interface RegenerateRequest {
  sessionId: string;
  dimension: DimensionType | 'direction';
}

/**
 * Response from regenerating options
 */
export interface RegenerateResponse {
  sessionId: string;
  images: GeneratedImage[];
  remainingRegenerations: number;
  creditsConsumed: number;
}

/**
 * Request to generate camera motion depth map
 */
export interface GenerateCameraMotionRequest {
  sessionId: string;
}

/**
 * Response from generating camera motion
 */
export interface GenerateCameraMotionResponse {
  sessionId: string;
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
  creditsConsumed: number;
}

/**
 * Request to select a camera motion
 */
export interface SelectCameraMotionRequest {
  sessionId: string;
  cameraMotionId: string;
}

/**
 * Request to generate subject motion preview
 */
export interface GenerateSubjectMotionRequest {
  sessionId: string;
  subjectMotion: string;
}

/**
 * Response from generating subject motion preview
 */
export interface GenerateSubjectMotionResponse {
  sessionId: string;
  videoUrl: string;
  prompt: string;
  creditsConsumed: number;
}

/**
 * Response from finalizing a session
 */
export interface FinalizeSessionResponse {
  sessionId: string;
  finalPrompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
  totalCreditsConsumed: number;
  generationCosts: Record<string, number>;
}

/**
 * Request to abandon a convergence session
 */
export interface AbandonSessionRequest {
  sessionId: string;
  deleteImages?: boolean;
}

/**
 * Response from abandoning a session
 */
export interface AbandonSessionResponse {
  sessionId: string;
  status: 'abandoned';
  imagesDeleted: boolean;
}

// ============================================================================
// Frontend-Specific Types
// ============================================================================

/**
 * Loading operation types for granular loading state (Requirement 9.7)
 */
export type LoadingOperation =
  | 'startSession'
  | 'selectOption'
  | 'regenerate'
  | 'depthEstimation'
  | 'videoPreview'
  | 'finalize'
  | null;

/**
 * Convergence error codes from the backend
 */
export const CONVERGENCE_ERROR_CODES = [
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'ACTIVE_SESSION_EXISTS',
  'INSUFFICIENT_CREDITS',
  'REGENERATION_LIMIT_EXCEEDED',
  'DEPTH_ESTIMATION_FAILED',
  'IMAGE_GENERATION_FAILED',
  'VIDEO_GENERATION_FAILED',
  'INCOMPLETE_SESSION',
  'UNAUTHORIZED',
  'INVALID_REQUEST',
] as const;
export type ConvergenceErrorCode = (typeof CONVERGENCE_ERROR_CODES)[number];

/**
 * API error response structure
 */
export interface ConvergenceApiError {
  code: ConvergenceErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Insufficient credits modal state
 */
export interface InsufficientCreditsModalState {
  required: number;
  available: number;
  operation: string;
}

/**
 * Handoff data for switching from Create to Studio mode (Requirement 17.6)
 */
export interface ConvergenceHandoff {
  prompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
}

/**
 * Direction option for display
 */
export interface DirectionOption {
  id: Direction;
  label: string;
}

/**
 * Generic option for dimension selection
 */
export interface SelectionOption {
  id: string;
  label: string;
}
