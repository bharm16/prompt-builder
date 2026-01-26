/**
 * StepCreditBadge Component
 *
 * Displays the credit cost for the current step in the convergence flow.
 * Shows a compact badge with coin icon and credit amount.
 *
 * @requirement 15.2 - Display credits consumed at each step
 */

import React from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { ConvergenceStep } from '@/features/convergence/types';

/**
 * Credit costs for convergence operations
 * Matches CONVERGENCE_COSTS from the backend
 */
const STEP_COSTS: Partial<Record<ConvergenceStep, number>> = {
  direction: 4, // 4 images × 1 credit each
  mood: 4,
  framing: 4,
  lighting: 4,
  final_frame: 2,
  camera_motion: 1, // Depth estimation
  subject_motion: 5, // Wan 2.2 preview
};

export interface StepCreditBadgeProps {
  /** Current step in the convergence flow */
  step: ConvergenceStep;
  /** Override the default cost for the step */
  cost?: number;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the label "credits" */
  showLabel?: boolean;
}

/**
 * Get the credit cost for a given step
 */
export function getStepCost(step: ConvergenceStep): number {
  return STEP_COSTS[step] ?? 0;
}

/**
 * StepCreditBadge - Shows credit cost for current step
 */
export const StepCreditBadge: React.FC<StepCreditBadgeProps> = ({
  step,
  cost,
  size = 'sm',
  className,
  showLabel = true,
}) => {
  const creditCost = cost ?? getStepCost(step);

  // Don't render if no cost
  if (creditCost === 0) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full',
        'bg-amber-50 text-amber-700 border border-amber-200',
        'font-medium',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`This step costs ${creditCost} credit${creditCost !== 1 ? 's' : ''}`}
    >
      <Coins className={cn(iconSizes[size], 'text-amber-500')} aria-hidden="true" />
      <span>{creditCost}</span>
      {showLabel && (
        <span className="text-amber-600/80">
          {creditCost === 1 ? 'credit' : 'credits'}
        </span>
      )}
    </div>
  );
};

StepCreditBadge.displayName = 'StepCreditBadge';

export default StepCreditBadge;
