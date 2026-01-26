/**
 * ProgressIndicator Component
 *
 * Displays a horizontal step indicator showing progress through the Visual Convergence flow.
 * Shows all steps with visual distinction between completed, current, and future steps.
 *
 * Features:
 * - Horizontal step indicator showing all steps
 * - Clickable completed steps for jumpToStep navigation
 * - Visual distinction: completed (checkmark), current (highlight), future (dimmed)
 * - Step labels (Direction, Mood, Framing, Lighting, Camera, Motion, Preview)
 *
 * @requirement 18.1 - Display progress indicator showing completed, current, and remaining steps
 * @requirement 18.2 - Allow clicking completed steps to navigate back
 * @requirement 18.3 - Visually distinguish between completed, current, and future steps
 * @requirement 18.4 - Display the label for each step
 * @requirement 18.5 - When clicking a completed step, unlock all dimensions after the target step
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getProgressSteps, getStepLabel, getStepOrder } from '@/features/convergence/utils';
import type { ConvergenceStep, StartingPointMode } from '@/features/convergence/types';

// ============================================================================
// Types
// ============================================================================

export interface ProgressIndicatorProps {
  /** Current step in the convergence flow */
  currentStep: ConvergenceStep;
  /** Starting point mode to determine visible steps */
  startingPointMode?: StartingPointMode | null;
  /** Callback when a completed step is clicked for navigation */
  onStepClick?: (step: ConvergenceStep) => void;
  /** Whether navigation is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Step state for visual rendering
 */
type StepState = 'completed' | 'current' | 'future';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the visual state of a step based on the current step
 */
function getStepState(
  step: ConvergenceStep,
  currentStep: ConvergenceStep,
  mode: StartingPointMode | null
): StepState {
  const stepIndex = getStepOrder(step, mode);
  const currentIndex = getStepOrder(currentStep, mode);

  if (stepIndex < currentIndex) {
    return 'completed';
  } else if (stepIndex === currentIndex) {
    return 'current';
  } else {
    return 'future';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StepButtonProps {
  step: ConvergenceStep;
  state: StepState;
  isFirst: boolean;
  isLast: boolean;
  onClick?: () => void;
  disabled?: boolean;
  mode: StartingPointMode | null;
}

/**
 * Individual step button in the progress indicator
 */
const StepButton: React.FC<StepButtonProps> = ({
  step,
  state,
  isFirst,
  isLast,
  onClick,
  disabled = false,
  mode,
}) => {
  const label = getStepLabel(step);
  const isClickable = state === 'completed' && !disabled;

  return (
    <div className="flex items-center">
      {/* Connector line (before step, except first) */}
      {!isFirst && (
        <div
          className={cn(
            'h-0.5 w-4 sm:w-8 md:w-12 transition-colors duration-200',
            state === 'future' ? 'bg-border' : 'bg-primary'
          )}
          aria-hidden="true"
        />
      )}

      {/* Step indicator */}
      <button
        type="button"
        onClick={isClickable ? onClick : undefined}
        disabled={!isClickable}
        className={cn(
          'flex flex-col items-center gap-1.5 group',
          isClickable && 'cursor-pointer',
          !isClickable && 'cursor-default'
        )}
        aria-label={`${label} - ${state === 'completed' ? 'Completed' : state === 'current' ? 'Current step' : 'Upcoming'}`}
        aria-current={state === 'current' ? 'step' : undefined}
      >
        {/* Circle indicator - Touch-friendly tap target: min 44px (Task 35.4) */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full border-2 transition-all duration-200',
            // Completed state
            state === 'completed' && 'bg-primary border-primary text-primary-foreground',
            state === 'completed' && isClickable && 'group-hover:bg-primary/80 group-hover:border-primary/80',
            state === 'completed' && isClickable && 'group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background',
            // Current state
            state === 'current' && 'bg-primary/10 border-primary text-primary',
            state === 'current' && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
            // Future state
            state === 'future' && 'bg-surface-2 border-border text-muted'
          )}
        >
          {state === 'completed' ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <span className="text-xs font-medium" aria-hidden="true">
              {getStepOrder(step, mode)}
            </span>
          )}
        </div>

        {/* Step label */}
        <span
          className={cn(
            'text-xs font-medium transition-colors duration-200 whitespace-nowrap',
            // Completed state
            state === 'completed' && 'text-foreground',
            state === 'completed' && isClickable && 'group-hover:text-primary',
            // Current state
            state === 'current' && 'text-primary font-semibold',
            // Future state
            state === 'future' && 'text-muted'
          )}
        >
          {label}
        </span>
      </button>

      {/* Connector line (after step, except last) */}
      {!isLast && (
        <div
          className={cn(
            'h-0.5 w-4 sm:w-8 md:w-12 transition-colors duration-200',
            state === 'completed' ? 'bg-primary' : 'bg-border'
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * ProgressIndicator - Horizontal step indicator for the convergence flow
 *
 * @example
 * ```tsx
 * <ProgressIndicator
 *   currentStep={state.step}
 *   onStepClick={(step) => actions.jumpToStep(step)}
 *   disabled={state.isLoading}
 * />
 * ```
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  startingPointMode = null,
  onStepClick,
  disabled = false,
  className,
}) => {
  // Get the steps to display (excludes 'intent' and 'complete')
  const steps = getProgressSteps(startingPointMode);

  /**
   * Handle step click - only for completed steps
   */
  const handleStepClick = React.useCallback(
    (step: ConvergenceStep) => {
      if (onStepClick && !disabled) {
        onStepClick(step);
      }
    },
    [onStepClick, disabled]
  );

  return (
    <nav
      className={cn(
        'flex items-center justify-center py-4 px-2 sm:px-4 bg-surface-1 border-b border-border',
        className
      )}
      aria-label="Convergence flow progress"
    >
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {steps.map((step, index) => {
          const state = getStepState(step, currentStep, startingPointMode);
          const isFirst = index === 0;
          const isLast = index === steps.length - 1;

          return (
            <StepButton
              key={step}
              step={step}
              state={state}
              isFirst={isFirst}
              isLast={isLast}
              onClick={() => handleStepClick(step)}
              disabled={disabled}
              mode={startingPointMode}
            />
          );
        })}
      </div>
    </nav>
  );
};

ProgressIndicator.displayName = 'ProgressIndicator';

export default ProgressIndicator;
