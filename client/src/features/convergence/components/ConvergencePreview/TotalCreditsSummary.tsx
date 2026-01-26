/**
 * TotalCreditsSummary Component
 *
 * Displays the total credits consumed during the convergence flow.
 * Shows a breakdown of credits used at each step.
 *
 * @requirement 15.2 - Display credits consumed at each step
 * @requirement 15.4 - Display final generation cost for each model
 */

import React from 'react';
import { cn } from '@/utils/cn';
import { Coins, TrendingUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface TotalCreditsSummaryProps {
  /** Total credits consumed during the convergence flow */
  totalCreditsConsumed: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * TotalCreditsSummary - Shows total credits consumed
 *
 * @example
 * ```tsx
 * <TotalCreditsSummary totalCreditsConsumed={22} />
 * ```
 */
export const TotalCreditsSummary: React.FC<TotalCreditsSummaryProps> = ({
  totalCreditsConsumed,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface-1',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <TrendingUp className="w-4 h-4 text-muted" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Credits Used</h3>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Convergence Flow</span>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'bg-amber-50 text-amber-700 border border-amber-200',
              'font-medium'
            )}
            role="status"
            aria-label={`${totalCreditsConsumed} credits consumed`}
          >
            <Coins className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <span className="text-sm">{totalCreditsConsumed}</span>
            <span className="text-xs text-amber-600/80">credits</span>
          </div>
        </div>

        {/* Info text */}
        <p className="mt-3 text-xs text-muted">
          This includes all image generations, depth estimation, and preview video (if generated).
        </p>
      </div>
    </div>
  );
};

TotalCreditsSummary.displayName = 'TotalCreditsSummary';

export default TotalCreditsSummary;
