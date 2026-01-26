/**
 * EstimatedCostBadge Component
 *
 * Displays the estimated total credit cost for completing the convergence flow.
 * Shows approximately 22 credits for a full flow without regenerations.
 *
 * @requirement 15.1 - Display estimated total credit cost for completion
 */

import React from 'react';
import { cn } from '@/utils/cn';
import { Coins, Info } from 'lucide-react';

/**
 * Estimated total credits for full convergence flow (without regenerations)
 * Direction (4) + Mood (4) + Framing (4) + Lighting (4) + Depth (1) + Wan Preview (5) = 22
 */
const ESTIMATED_TOTAL_COST = 22;

export interface EstimatedCostBadgeProps {
  /** Override the default estimated cost */
  estimatedCost?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the info tooltip */
  showTooltip?: boolean;
  /** Variant style */
  variant?: 'default' | 'subtle' | 'prominent';
}

/**
 * EstimatedCostBadge - Shows estimated total cost for convergence flow
 */
export const EstimatedCostBadge: React.FC<EstimatedCostBadgeProps> = ({
  estimatedCost = ESTIMATED_TOTAL_COST,
  size = 'md',
  className,
  showTooltip = true,
  variant = 'default',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const variantClasses = {
    default: 'bg-surface-2 text-foreground border border-border',
    subtle: 'bg-transparent text-muted',
    prominent: 'bg-primary/10 text-primary border border-primary/20',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label={`Estimated cost: approximately ${estimatedCost} credits`}
    >
      <Coins
        className={cn(
          iconSizes[size],
          variant === 'prominent' ? 'text-primary' : 'text-amber-500'
        )}
        aria-hidden="true"
      />
      <span>~{estimatedCost}</span>
      <span className={cn(variant === 'subtle' ? 'text-muted' : 'opacity-70')}>
        credits
      </span>
      {showTooltip && (
        <div className="group relative">
          <Info
            className={cn(
              iconSizes[size],
              'cursor-help opacity-50 hover:opacity-100 transition-opacity'
            )}
            aria-hidden="true"
          />
          {/* Tooltip */}
          <div
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
              'invisible group-hover:visible opacity-0 group-hover:opacity-100',
              'transition-all duration-200',
              'w-48 p-2 rounded-lg shadow-lg',
              'bg-neutral-900 text-white text-xs',
              'z-50'
            )}
            role="tooltip"
          >
            <p className="font-medium mb-1">Estimated Total Cost</p>
            <p className="text-neutral-300">
              Includes direction, mood, framing, lighting, camera motion, and
              subject motion preview. Regenerations cost extra.
            </p>
            {/* Tooltip arrow */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral-900"
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </div>
  );
};

EstimatedCostBadge.displayName = 'EstimatedCostBadge';

export default EstimatedCostBadge;
