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
export type Direction = 'cinematic' | 'social' | 'artistic' | 'documentary';

/**
 * Visual attribute categories that users select from
 */
export type DimensionType = 'mood' | 'framing' | 'lighting' | 'camera_motion';

/**
 * Steps in the convergence flow
 */
export type ConvergenceStep =
  | 'intent'
  | 'direction'
  | 'mood'
  | 'framing'
  | 'lighting'
  | 'camera_motion'
  | 'subject_motion'
  | 'preview'
  | 'complete';

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
  url: string; // GCS URL (permanent)
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
export type SessionStatus = 'active' | 'completed' | 'abandoned';

/**
 * Firestore schema for convergence sessions
 * Tracks a user's progress through the visual convergence flow
 */
export interface ConvergenceSession {
  id: string; // UUID v4
  userId: string; // Firebase Auth UID
  intent: string; // Original user input
  direction: Direction | null; // Selected direction
  lockedDimensions: LockedDimension[]; // Array of locked selections
  currentStep: ConvergenceStep; // Current step in flow
  generatedImages: GeneratedImage[]; // All generated images (GCS URLs)
  imageHistory: Record<string, GeneratedImage[]>; // Images per dimension for back nav
  regenerationCounts: Record<string, number>; // Regen count per dimension
  depthMapUrl: string | null; // GCS URL to depth map
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

// ============================================================================
// Credit Types
// ============================================================================

/**
 * Status of a credit reservation
 */
export type CreditReservationStatus = 'pending' | 'committed' | 'refunded';

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
