/**
 * Components for Visual Convergence Feature
 *
 * This module exports all UI components for the convergence flow.
 */

// Shared components
export * from './shared';

// Modal components
export { ResumeSessionModal, type ResumeSessionModalProps } from './modals';
export { InsufficientCreditsModal, type InsufficientCreditsModalProps } from './modals';

// Main orchestrator component
export { ConvergenceFlow, type ConvergenceFlowProps } from './ConvergenceFlow';

// Flow step components
export { IntentInput, type IntentInputProps } from './IntentInput';
export {
  StartingPointSelector,
  ImageUploader,
  type StartingPointSelectorProps,
  type ImageUploaderProps,
} from './StartingPointSelector';
export { DirectionFork, type DirectionForkProps } from './DirectionFork';
export { DimensionSelector, type DimensionSelectorProps } from './DimensionSelector';
export {
  FinalFrameConfirmation,
  type FinalFrameConfirmationProps,
} from './FinalFrameConfirmation';
export {
  CameraMotionPicker,
  CameraMotionPickerWithErrorBoundary,
  CameraMotionOption,
  CameraMotionErrorBoundary,
  CAMERA_MOTION_DESCRIPTIONS,
  type CameraMotionPickerProps,
  type CameraMotionPickerWithErrorBoundaryProps,
  type CameraMotionOptionProps,
  type CameraMotionErrorBoundaryProps,
} from './CameraMotionPicker';
export { SubjectMotionInput, type SubjectMotionInputProps } from './SubjectMotionInput';
export {
  ConvergencePreview,
  PromptDisplay,
  DimensionSummary,
  TotalCreditsSummary,
  GenerateNowButton,
  EditInStudioButton,
  ModelCostTable,
  type ConvergencePreviewProps,
  type PromptDisplayProps,
  type DimensionSummaryProps,
  type TotalCreditsSummaryProps,
  type GenerateNowButtonProps,
  type EditInStudioButtonProps,
  type ModelCostTableProps,
} from './ConvergencePreview';
export { ProgressIndicator, type ProgressIndicatorProps } from './ProgressIndicator';
