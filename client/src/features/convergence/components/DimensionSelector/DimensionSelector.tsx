/**
 * DimensionSelector Component
 *
 * Reusable component for selecting dimension options (mood, framing, lighting)
 * in the Visual Convergence flow. Displays 4 options with generated images.
 *
 * Features:
 * - Accepts dimension type prop (mood, framing, lighting)
 * - Shows appropriate title based on dimension type
 * - Displays StepCreditBadge showing 4 credits
 * - Uses ImageGrid to display the 4 dimension options
 * - Includes BackButton to go to previous step
 * - Includes RegenerateButton with remaining count
 * - Supports keyboard navigation with focusedOptionIndex
 *
 * @requirement 3.1 - Select dimension option and lock dimension
 * @requirement 12.5-12.6 - Keyboard navigation support
 * @requirement 13.1 - Display Back control
 * @requirement 14.1 - Display Regenerate control
 */

import React from 'react';
import { Palette, Frame, Sun } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  ImageGrid,
  StepCreditBadge,
  RegenerateButton,
  BackButton,
} from '../shared';
import type {
  DimensionType,
  GeneratedImage,
  SelectionOption,
} from '@/features/convergence/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Configuration for each dimension type
 */
interface DimensionDisplayConfig {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

type SelectableDimension = Exclude<DimensionType, 'camera_motion'>;

const DIMENSION_CONFIG: Record<SelectableDimension, DimensionDisplayConfig> = {
  mood: {
    title: 'Choose Your Mood',
    description: 'Select the emotional tone for your video',
    icon: Palette,
  },
  framing: {
    title: 'Choose Your Framing',
    description: 'Select how your subject is framed',
    icon: Frame,
  },
  lighting: {
    title: 'Choose Your Lighting',
    description: 'Select the lighting style for your video',
    icon: Sun,
  },
};

/**
 * Default options for each dimension type
 * These match the backend DimensionFragments configuration
 */
const DEFAULT_OPTIONS: Record<SelectableDimension, SelectionOption[]> = {
  mood: [
    { id: 'dramatic', label: 'Dramatic' },
    { id: 'peaceful', label: 'Peaceful' },
    { id: 'mysterious', label: 'Mysterious' },
    { id: 'nostalgic', label: 'Nostalgic' },
  ],
  framing: [
    { id: 'wide', label: 'Wide Shot' },
    { id: 'medium', label: 'Medium Shot' },
    { id: 'closeup', label: 'Close-up' },
    { id: 'extreme_closeup', label: 'Extreme Close-up' },
  ],
  lighting: [
    { id: 'golden_hour', label: 'Golden Hour' },
    { id: 'blue_hour', label: 'Blue Hour' },
    { id: 'high_key', label: 'High Key' },
    { id: 'low_key', label: 'Low Key' },
  ],
};

// ============================================================================
// Types
// ============================================================================

export interface DimensionSelectorProps {
  /** The dimension type being selected (mood, framing, or lighting) */
  dimensionType: SelectableDimension;
  /** Generated images for each dimension option */
  images: GeneratedImage[];
  /** Options to display (defaults to dimension-specific options) */
  options?: SelectionOption[];
  /** Currently selected option ID (if any) */
  selectedOptionId?: string | null;
  /** Currently focused option index for keyboard navigation */
  focusedOptionIndex?: number;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Number of regenerations used for this dimension */
  regenerationCount?: number;
  /** Whether regeneration is in progress */
  isRegenerating?: boolean;
  /** Callback when an option is selected */
  onSelect?: (optionId: string) => void;
  /** Callback when regenerate is clicked */
  onRegenerate?: () => void;
  /** Callback when back is clicked */
  onBack?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether selection is disabled (e.g., during loading) */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DimensionSelector - Reusable dimension selection component
 *
 * @example
 * ```tsx
 * <DimensionSelector
 *   dimensionType="mood"
 *   images={state.currentImages}
 *   selectedOptionId={null}
 *   focusedOptionIndex={state.focusedOptionIndex}
 *   isLoading={state.loadingOperation === 'selectOption'}
 *   regenerationCount={state.regenerationCounts.get('mood') ?? 0}
 *   isRegenerating={state.loadingOperation === 'regenerate'}
 *   onSelect={(optionId) => actions.selectOption('mood', optionId)}
 *   onRegenerate={() => actions.regenerate()}
 *   onBack={() => actions.goBack()}
 * />
 * ```
 */
export const DimensionSelector: React.FC<DimensionSelectorProps> = ({
  dimensionType,
  images,
  options,
  selectedOptionId,
  focusedOptionIndex = -1,
  isLoading = false,
  regenerationCount = 0,
  isRegenerating = false,
  onSelect,
  onRegenerate,
  onBack,
  className,
  disabled = false,
}) => {
  // Get dimension-specific configuration
  const config = DIMENSION_CONFIG[dimensionType];
  const displayOptions = options ?? DEFAULT_OPTIONS[dimensionType];
  const IconComponent = config.icon;

  /**
   * Handle option selection
   */
  const handleSelect = React.useCallback(
    (id: string) => {
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
      {/* Header Section (Task 21.1) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        {/* Title with icon */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10"
            aria-hidden="true"
          >
            <IconComponent className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {config.title}
            </h2>
            <p className="text-sm text-muted">
              {config.description}
            </p>
          </div>
        </div>

        {/* Step Credit Badge (Task 21.4) */}
        <StepCreditBadge
          step={dimensionType}
          size="md"
          showLabel={true}
        />
      </div>

      {/* Image Grid (Task 21.2) */}
      <ImageGrid
        images={images}
        options={displayOptions}
        selectedId={selectedOptionId ?? null}
        focusedIndex={focusedOptionIndex}
        isLoading={isLoading}
        skeletonCount={4}
        onSelect={handleSelect}
        disabled={isDisabled}
        aspectRatio="square"
        className="mb-6"
      />

      {/* Actions Section (Tasks 21.3, 21.4) */}
      <div className="flex items-center justify-between">
        {/* Back Button (Task 21.3) */}
        <BackButton
          onBack={onBack ?? undefined}
          disabled={isDisabled || isRegenerating}
          size="md"
        />

        {/* Regenerate Button (Task 21.4) */}
        <RegenerateButton
          regenerationCount={regenerationCount}
          isLoading={isRegenerating}
          disabled={isDisabled || isRegenerating}
          onRegenerate={onRegenerate ?? undefined}
          size="md"
          showCost={true}
        />
      </div>

      {/* Keyboard Navigation Hint (Task 21.5) */}
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
          to select,{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-xs font-mono">
            Escape
          </kbd>{' '}
          to go back
        </p>
      )}
    </div>
  );
};

DimensionSelector.displayName = 'DimensionSelector';

export default DimensionSelector;
