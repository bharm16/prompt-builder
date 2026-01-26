/**
 * Visual Convergence Feature
 *
 * The Visual Convergence feature transforms PromptCanvas into a visual-first video creation platform.
 * Users make creative decisions by selecting from generated images rather than writing prompts.
 * The system guides users through a progressive refinement flow:
 * Direction → Mood → Framing → Lighting → Camera Motion → Subject Motion → Final Generation.
 *
 * Barrel exports for the convergence feature
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  Direction,
  DimensionType,
  ConvergenceStep,
  StartingPointMode,
  // Camera motion types
  Position3D,
  CameraPath,
  // Dimension configuration types
  DimensionOption,
  DimensionConfig,
  LockedDimension,
  // Generated asset types
  GeneratedImage,
  // Session types
  SessionStatus,
  ConvergenceSession,
  // API request/response types
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
  UploadImageResponse,
  // Frontend-specific types
  LoadingOperation,
  ConvergenceErrorCode,
  ConvergenceApiError,
  InsufficientCreditsModalState,
  ConvergenceHandoff,
  DirectionOption,
  SelectionOption,
  StartingPointOption,
} from './types';

// ============================================================================
// Utils
// ============================================================================

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
} from './utils';

// ============================================================================
// API
// ============================================================================

export {
  convergenceApi,
  ConvergenceError,
  startSession,
  selectOption,
  regenerate,
  generateCameraMotion,
  selectCameraMotion,
  generateSubjectMotion,
  finalizeSession,
  setStartingPoint,
  generateFinalFrame,
  regenerateFinalFrame,
  getActiveSession,
  getSession,
} from './api';

// ============================================================================
// Hooks
// ============================================================================

export {
  useConvergenceSession,
  convergenceReducer,
  initialState,
  type ConvergenceState,
  type ConvergenceAction,
  type ConvergenceActions,
  type UseConvergenceSessionReturn,
} from './hooks';

// ============================================================================
// Components
// ============================================================================

export {
  // Main orchestrator component
  ConvergenceFlow,
  type ConvergenceFlowProps,
  // Loading state components
  ImageSkeleton,
  type ImageSkeletonProps,
  // Image selection components
  ImageOption,
  type ImageOptionProps,
  ImageGrid,
  type ImageGridProps,
  // Credit display components
  StepCreditBadge,
  type StepCreditBadgeProps,
  getStepCost,
  EstimatedCostBadge,
  type EstimatedCostBadgeProps,
  // Action components
  RegenerateButton,
  type RegenerateButtonProps,
  // Flow step components
  IntentInput,
  type IntentInputProps,
  // Preview components
  ConvergencePreview,
  type ConvergencePreviewProps,
  PromptDisplay,
  type PromptDisplayProps,
  DimensionSummary,
  type DimensionSummaryProps,
  TotalCreditsSummary,
  type TotalCreditsSummaryProps,
  GenerateNowButton,
  type GenerateNowButtonProps,
  EditInStudioButton,
  type EditInStudioButtonProps,
  ModelCostTable,
  type ModelCostTableProps,
  // Progress indicator
  ProgressIndicator,
  type ProgressIndicatorProps,
  // Modal components
  ResumeSessionModal,
  type ResumeSessionModalProps,
  InsufficientCreditsModal,
  type InsufficientCreditsModalProps,
} from './components';
