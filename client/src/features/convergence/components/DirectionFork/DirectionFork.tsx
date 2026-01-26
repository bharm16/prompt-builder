/**
 * DirectionFork Component
 *
 * Displays the direction selection step in the Visual Convergence flow.
 * Shows 4 direction options (cinematic, social, artistic, documentary)
 * with generated images for each.
 *
 * Features:
 * - Title "Choose Your Direction"
 * - StepCreditBadge showing 4 credits
 * - ImageGrid with 4 direction options
 * - Loading state with ImageSkeleton
 * - RegenerateButton with remaining count
 * - Keyboard navigation with focusedOptionIndex
 *
 * @requirement 2.1 - Generate one image per direction option
 * @requirement 2.4 - Lock direction and proceed to mood dimension on selection
 * @requirement 12.5-12.6 - Keyboard navigation support
 * @requirement 14.1 - Display Regenerate control
 */

import React from 'react';
import { Compass } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  ImageGrid,
  StepCreditBadge,
  RegenerateButton,
} from '../shared';
import type {
  Direction,
  GeneratedImage,
  DirectionOption,
} from '@/features/convergence/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Direction options for the fork
 * Matches DIRECTION_OPTIONS from the backend
 */
const DIRECTION_OPTIONS: DirectionOption[] = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'social', label: 'Social' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'documentary', label: 'Documentary' },
];

// ============================================================================
// Types
// ============================================================================

export interface DirectionForkProps {
  /** Generated images for each direction option */
  images: GeneratedImage[];
  /** Currently selected direction (if any) */
  selectedDirection?: Direction | null;
  /** Currently focused option index for keyboard navigation */
  focusedOptionIndex?: number;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Number of regenerations used for this step */
  regenerationCount?: number;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
  /** Callback when a direction is selected */
  onSelect?: (direction: Direction) => void;
  /** Callback when regenerate is clicked */
  onRegenerate?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether selection is disabled (e.g., during loading) */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DirectionFork - Direction selection step in the convergence flow
 *
 * @example
 * ```tsx
 * <DirectionFork
 *   images={state.currentImages}
 *   selectedDirection={state.direction}
 *   focusedOptionIndex={state.focusedOptionIndex}
 *   isLoading={state.loadingOperation === 'startSession'}
 *   regenerationCount={state.regenerationCounts.get('direction') ?? 0}
 *   isRegenerating={state.loadingOperation === 'regenerate'}
 *   onSelect={(direction) => actions.selectOption('direction', direction)}
 *   onRegenerate={() => actions.regenerate()}
 * />
 * ```
 */
export const DirectionFork: React.FC<DirectionForkProps> = ({
  images,
  selectedDirection,
  focusedOptionIndex = -1,
  isLoading = false,
  regenerationCount = 0,
  isRegenerating = false,
  onSelect,
  onRegenerate,
  className,
  disabled = false,
}) => {
  /**
   * Handle direction selection
   * Casts the string ID to Direction type
   */
  const handleSelect = React.useCallback(
    (id: Direction) => {
      if (onSelect && !disabled && !isLoading) {
        onSelect(id);
      }
    },
    [onSelect, disabled, isLoading]
  );

  const isDisabled = disabled || isLoading;

  return (
    <div
      className={cn(
        'flex flex-col w-full max-w-4xl mx-auto px-4',
        className
      )}
    >
      {/* Header Section (Task 20.1) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        {/* Title with icon */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10"
            aria-hidden="true"
          >
            <Compass className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Choose Your Direction
            </h2>
            <p className="text-sm text-muted">
              Select the overall style for your video
            </p>
          </div>
        </div>

        {/* Step Credit Badge */}
        <StepCreditBadge
          step="direction"
          size="md"
          showLabel={true}
        />
      </div>

      {/* Image Grid (Tasks 20.2, 20.3) */}
      <ImageGrid
        images={images}
        options={DIRECTION_OPTIONS}
        selectedId={selectedDirection}
        focusedIndex={focusedOptionIndex}
        isLoading={isLoading}
        skeletonCount={4}
        onSelect={handleSelect}
        disabled={isDisabled}
        aspectRatio="square"
        className="mb-6"
      />

      {/* Actions Section (Task 20.4) */}
      <div className="flex items-center justify-center">
        <RegenerateButton
          regenerationCount={regenerationCount}
          isLoading={isRegenerating}
          disabled={isDisabled || isRegenerating}
          onRegenerate={onRegenerate}
          size="md"
          showCost={true}
        />
      </div>

      {/* Keyboard Navigation Hint */}
      {!isLoading && (
        <p className="text-xs text-muted text-center mt-4">
          Use{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">
            Arrow keys
          </kbd>{' '}
          to navigate,{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">
            Enter
          </kbd>{' '}
          to select
        </p>
      )}
    </div>
  );
};

DirectionFork.displayName = 'DirectionFork';

export default DirectionFork;
