/**
 * Helper functions for the Visual Convergence feature (Frontend)
 *
 * These functions handle navigation through the convergence flow steps and dimensions.
 * Mirrors the backend helpers in server/src/services/convergence/helpers.ts
 */

import type { ConvergenceStep, DimensionType } from '../types';

// ============================================================================
// Order Constants
// ============================================================================

/**
 * The ordered sequence of steps in the convergence flow
 */
export const STEP_ORDER: ConvergenceStep[] = [
  'intent',
  'direction',
  'mood',
  'framing',
  'lighting',
  'camera_motion',
  'subject_motion',
  'preview',
  'complete',
];

/**
 * The ordered sequence of dimensions (including direction)
 */
export const DIMENSION_ORDER = [
  'direction',
  'mood',
  'framing',
  'lighting',
  'camera_motion',
] as const;

// ============================================================================
// Step Navigation Functions
// ============================================================================

/**
 * Gets the index of a step in the step order
 * @param step - The step to get the order for
 * @returns The index of the step in STEP_ORDER, or -1 if not found
 */
export function getStepOrder(step: ConvergenceStep): number {
  return STEP_ORDER.indexOf(step);
}

/**
 * Gets the next step in the convergence flow
 * @param current - The current step
 * @returns The next step, or 'complete' if at the end
 */
export function getNextStep(current: ConvergenceStep): ConvergenceStep {
  const idx = getStepOrder(current);
  return STEP_ORDER[idx + 1] || 'complete';
}

/**
 * Gets the previous step in the convergence flow
 * @param current - The current step
 * @returns The previous step, or the first step if at the beginning
 */
export function getPreviousStep(current: ConvergenceStep): ConvergenceStep {
  const idx = getStepOrder(current);
  const prevIdx = Math.max(0, idx - 1);
  return STEP_ORDER[prevIdx] ?? 'intent';
}

// ============================================================================
// Dimension Navigation Functions
// ============================================================================

/**
 * Gets the index of a dimension in the dimension order
 * @param dimension - The dimension to get the order for
 * @returns The index of the dimension in DIMENSION_ORDER, or -1 if not found
 */
export function getDimensionOrder(dimension: DimensionType | 'direction'): number {
  return DIMENSION_ORDER.indexOf(dimension);
}

/**
 * Gets the next dimension in the flow
 * @param current - The current dimension
 * @returns The next dimension, or null if at the end (camera_motion)
 */
export function getNextDimension(current: DimensionType | 'direction'): DimensionType | null {
  const flow: Record<string, DimensionType> = {
    direction: 'mood',
    mood: 'framing',
    framing: 'lighting',
    lighting: 'camera_motion',
  };
  return flow[current] || null;
}

/**
 * Gets the previous dimension in the flow
 * @param current - The current dimension
 * @returns The previous dimension, or null if at the beginning (direction)
 */
export function getPreviousDimension(
  current: DimensionType | 'direction'
): DimensionType | 'direction' | null {
  const flow: Record<string, DimensionType | 'direction'> = {
    mood: 'direction',
    framing: 'mood',
    lighting: 'framing',
    camera_motion: 'lighting',
  };
  return flow[current] || null;
}

// ============================================================================
// Step/Dimension Conversion Functions
// ============================================================================

/**
 * Converts a step to its corresponding dimension
 * @param step - The step to convert
 * @returns The corresponding dimension, or null if the step is not a dimension step
 */
export function stepToDimension(step: ConvergenceStep): DimensionType | 'direction' | null {
  if (step === 'direction') return 'direction';
  if (['mood', 'framing', 'lighting', 'camera_motion'].includes(step)) {
    return step as DimensionType;
  }
  return null;
}

/**
 * Converts a dimension to its corresponding step
 * @param dimension - The dimension to convert
 * @returns The corresponding step
 */
export function dimensionToStep(dimension: DimensionType | 'direction'): ConvergenceStep {
  return dimension as ConvergenceStep;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a step is a dimension selection step
 * @param step - The step to check
 * @returns True if the step involves dimension selection
 */
export function isDimensionStep(step: ConvergenceStep): boolean {
  return ['direction', 'mood', 'framing', 'lighting', 'camera_motion'].includes(step);
}

/**
 * Gets all dimensions that should be locked before a given step
 * @param step - The target step
 * @returns Array of dimensions that should be locked
 */
export function getRequiredLockedDimensions(
  step: ConvergenceStep
): Array<DimensionType | 'direction'> {
  const stepIdx = getStepOrder(step);
  const result: Array<DimensionType | 'direction'> = [];

  for (const dim of DIMENSION_ORDER) {
    const dimStep = dimensionToStep(dim);
    if (getStepOrder(dimStep) < stepIdx) {
      result.push(dim);
    }
  }

  return result;
}

/**
 * Gets the step label for display in the progress indicator
 * @param step - The step to get the label for
 * @returns Human-readable label for the step
 */
export function getStepLabel(step: ConvergenceStep): string {
  const labels: Record<ConvergenceStep, string> = {
    intent: 'Intent',
    direction: 'Direction',
    mood: 'Mood',
    framing: 'Framing',
    lighting: 'Lighting',
    camera_motion: 'Camera',
    subject_motion: 'Motion',
    preview: 'Preview',
    complete: 'Complete',
  };
  return labels[step];
}

/**
 * Checks if a step is before another step in the flow
 * @param step - The step to check
 * @param reference - The reference step
 * @returns True if step comes before reference
 */
export function isStepBefore(step: ConvergenceStep, reference: ConvergenceStep): boolean {
  return getStepOrder(step) < getStepOrder(reference);
}

/**
 * Checks if a step is after another step in the flow
 * @param step - The step to check
 * @param reference - The reference step
 * @returns True if step comes after reference
 */
export function isStepAfter(step: ConvergenceStep, reference: ConvergenceStep): boolean {
  return getStepOrder(step) > getStepOrder(reference);
}

/**
 * Gets all steps that are visible in the progress indicator
 * (excludes 'intent' and 'complete' which are not shown as steps)
 */
export function getProgressSteps(): ConvergenceStep[] {
  return ['direction', 'mood', 'framing', 'lighting', 'camera_motion', 'subject_motion', 'preview'];
}
