/**
 * Shared Components for Visual Convergence Feature
 *
 * This module exports reusable UI components used across the convergence flow.
 */

// Loading state components
export { ImageSkeleton, type ImageSkeletonProps } from './ImageSkeleton';

// Image selection components
export { ImageOption, type ImageOptionProps } from './ImageOption';
export { ImageGrid, type ImageGridProps } from './ImageGrid';

// Credit display components
export { StepCreditBadge, type StepCreditBadgeProps, getStepCost } from './StepCreditBadge';
export { EstimatedCostBadge, type EstimatedCostBadgeProps } from './EstimatedCostBadge';

// Action components
export { RegenerateButton, type RegenerateButtonProps } from './RegenerateButton';
export { BackButton, type BackButtonProps } from './BackButton';

// Animation components
export { FrameAnimator, useFrameAnimator, type FrameAnimatorProps } from './FrameAnimator';

// Error display components
export { ErrorDisplay, type ErrorDisplayProps } from './ErrorDisplay';

// Network status components
export { NetworkStatusBanner, type NetworkStatusBannerProps } from './NetworkStatusBanner';
