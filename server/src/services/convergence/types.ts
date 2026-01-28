/**
 * Type definitions for the Visual Convergence feature
 * 
 * The Visual Convergence feature transforms PromptCanvas into a visual-first video creation platform.
 * Users make creative decisions by selecting from generated images rather than writing prompts.
 */

// ============================================================================
// Core Types
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
 * Starting point modes for the convergence flow
 */
export const STARTING_POINT_MODES = ['upload', 'quick', 'converge'] as const;
export type StartingPointMode = (typeof STARTING_POINT_MODES)[number];

/**
 * Steps in the convergence flow
 */
export const CONVERGENCE_STEPS = [
  'intent',
  'starting_point',
  'direction',
  'mood',
  'framing',
  'lighting',
  'final_frame',
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
 * Camera motion categories for grouping and filtering motions
 */
export const CAMERA_MOTION_CATEGORIES = [
  'static',
  'pan_tilt',
  'dolly',
  'crane',
  'orbital',
  'compound',
] as const;
export type CameraMotionCategory = (typeof CAMERA_MOTION_CATEGORIES)[number];

/**
 * 3D position for camera path interpolation
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Camera rotation in Euler angles (radians)
 * Converted to quaternions internally for SLERP interpolation to avoid gimbal lock
 */
export interface Rotation3D {
  /** Pitch - rotation around X axis (tilt up/down) */
  pitch: number;
  /** Yaw - rotation around Y axis (pan left/right) */
  yaw: number;
  /** Roll - rotation around Z axis (dutch angle) */
  roll: number;
}

/**
 * Complete camera transform including position and rotation
 */
export interface CameraTransform {
  position: Position3D;
  rotation: Rotation3D;
}

/**
 * Legacy camera path format (position only, no rotation)
 * @deprecated Use CameraPath with CameraTransform instead
 */
export interface LegacyCameraPath {
  id: string;
  label: string;
  start: Position3D;
  end: Position3D;
  duration: number;
}

/**
 * Predefined 3D camera movement trajectory used for depth-based parallax rendering
 * Supports both position translation and rotation (pan, tilt, roll)
 */
export interface CameraPath {
  id: string;
  label: string;
  category: CameraMotionCategory;
  start: CameraTransform;
  end: CameraTransform;
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
 * Firestore schema for convergence sessions
 * Tracks a user's progress through the visual convergence flow
 */
export interface ConvergenceSession {
  id: string; // UUID v4
  userId: string; // Firebase Auth UID
  intent: string; // Original user input
  aspectRatio: string; // Aspect ratio for generated images
  direction: Direction | null; // Selected direction
  lockedDimensions: LockedDimension[]; // Array of locked selections
  currentStep: ConvergenceStep; // Current step in flow
  generatedImages: GeneratedImage[]; // All generated images (signed GCS URLs)
  imageHistory: Record<string, GeneratedImage[]>; // Images per dimension for back nav
  regenerationCounts: Record<string, number>; // Regen count per dimension
  startingPointMode: StartingPointMode | null; // Selected starting point mode
  finalFrameUrl: string | null; // HQ final frame for i2v
  finalFrameRegenerations: number; // Regeneration count for final frame
  uploadedImageUrl: string | null; // Uploaded image URL for upload mode
  depthMapUrl: string | null; // Signed GCS URL to depth map
  cameraMotion: string | null; // Selected camera motion ID
  subjectMotion: string | null; // User's subject motion text
  finalPrompt: string | null; // Complete generated prompt
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
  currentDimension: 'starting_point' | 'direction';
  options?: Array<{ id: Direction; label: string }>;
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
  currentDimension: DimensionType | 'camera_motion' | 'subject_motion' | 'final_frame';
  lockedDimensions: LockedDimension[];
  options?: Array<{ id: string; label: string }>;
  creditsConsumed: number;
  direction?: Direction; // Set when direction is selected
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
  depthMapUrl: string | null; // null when fallbackMode is true
  cameraPaths: CameraPath[];
  fallbackMode: boolean; // true if depth estimation failed
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
  inputMode: 'i2v' | 't2v';
  startImageUrl: string | null;
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
  generationCosts: Record<string, number>; // model -> cost
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

/**
 * Request to set the starting point for the convergence flow
 */
export interface SetStartingPointRequest {
  sessionId: string;
  mode: StartingPointMode;
  imageUrl?: string;
}

/**
 * Response from setting the starting point
 */
export interface SetStartingPointResponse {
  sessionId: string;
  mode: StartingPointMode;
  finalFrameUrl?: string;
  nextStep: ConvergenceStep;
  creditsConsumed: number;
  images?: GeneratedImage[];
  options?: Array<{ id: Direction; label: string }>;
}

/**
 * Request to generate the final frame (HQ image)
 */
export interface GenerateFinalFrameRequest {
  sessionId: string;
}

/**
 * Response from generating the final frame
 */
export interface GenerateFinalFrameResponse {
  sessionId: string;
  finalFrameUrl: string;
  prompt: string;
  remainingRegenerations: number;
  creditsConsumed: number;
}

/**
 * Request to regenerate the final frame
 */
export interface RegenerateFinalFrameRequest {
  sessionId: string;
}

// ============================================================================
// Credit Types
// ============================================================================

/**
 * Status of a credit reservation
 */
export const CREDIT_RESERVATION_STATUSES = ['pending', 'committed', 'refunded'] as const;
export type CreditReservationStatus = (typeof CREDIT_RESERVATION_STATUSES)[number];

/**
 * Credit reservation for atomic credit operations
 * Tracks the lifecycle of reserved credits through pending → committed/refunded
 */
export interface CreditReservation {
  id: string;
  userId: string;
  amount: number;
  createdAt: Date;
  status: CreditReservationStatus;
}
