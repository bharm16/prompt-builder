/**
 * DimensionSummary Component
 *
 * Displays a summary of all locked dimension selections as badges.
 * Shows the user's creative choices throughout the convergence flow.
 *
 * @requirement 8.1 - Return locked dimensions on finalization
 */

import React from 'react';
import { Layers, Film, Palette, Frame, Sun, Video, Move } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { LockedDimension, Direction } from '@/features/convergence/types';

// ============================================================================
// Types
// ============================================================================

export interface DimensionSummaryProps {
  /** The selected direction */
  direction?: Direction | null | undefined;
  /** Array of locked dimension selections */
  lockedDimensions: LockedDimension[];
  /** Selected camera motion */
  cameraMotion?: string | null | undefined;
  /** Subject motion description */
  subjectMotion?: string | null | undefined;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Icons for each dimension type
 */
const DIMENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  direction: Film,
  mood: Palette,
  framing: Frame,
  lighting: Sun,
  camera_motion: Video,
  subject_motion: Move,
};

/**
 * Labels for each dimension type
 */
const DIMENSION_LABELS: Record<string, string> = {
  direction: 'Direction',
  mood: 'Mood',
  framing: 'Framing',
  lighting: 'Lighting',
  camera_motion: 'Camera',
  subject_motion: 'Motion',
};

/**
 * Direction labels
 */
const DIRECTION_LABELS: Record<Direction, string> = {
  cinematic: 'Cinematic',
  social: 'Social',
  artistic: 'Artistic',
  documentary: 'Documentary',
};

/**
 * Camera motion labels
 */
const CAMERA_MOTION_LABELS: Record<string, string> = {
  static: 'Static',
  pan_left: 'Pan Left',
  pan_right: 'Pan Right',
  push_in: 'Push In',
  pull_back: 'Pull Back',
  crane_up: 'Crane Up',
};

// ============================================================================
// Component
// ============================================================================

/**
 * DimensionSummary - Shows locked selections as badges
 *
 * @example
 * ```tsx
 * <DimensionSummary
 *   direction="cinematic"
 *   lockedDimensions={[
 *     { type: 'mood', optionId: 'dramatic', label: 'Dramatic', promptFragments: [] },
 *     { type: 'framing', optionId: 'wide', label: 'Wide Shot', promptFragments: [] },
 *   ]}
 *   cameraMotion="pan_left"
 *   subjectMotion="Walking slowly forward"
 * />
 * ```
 */
export const DimensionSummary: React.FC<DimensionSummaryProps> = ({
  direction,
  lockedDimensions,
  cameraMotion,
  subjectMotion,
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
        <Layers className="w-4 h-4 text-muted" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Your Selections</h3>
      </div>

      {/* Badges Grid */}
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {/* Direction Badge */}
          {direction && (
            <DimensionBadge
              type="direction"
              label={DIRECTION_LABELS[direction]}
            />
          )}

          {/* Locked Dimension Badges */}
          {lockedDimensions.map((dim) => (
            <DimensionBadge
              key={dim.type}
              type={dim.type}
              label={dim.label}
            />
          ))}

          {/* Camera Motion Badge */}
          {cameraMotion && (
            <DimensionBadge
              type="camera_motion"
              label={CAMERA_MOTION_LABELS[cameraMotion] || cameraMotion}
            />
          )}

          {/* Subject Motion Badge */}
          {subjectMotion && subjectMotion.trim() && (
            <DimensionBadge
              type="subject_motion"
              label={subjectMotion.length > 30 ? `${subjectMotion.slice(0, 30)}...` : subjectMotion}
              tooltip={subjectMotion}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface DimensionBadgeProps {
  type: string;
  label: string;
  tooltip?: string;
}

/**
 * Individual dimension badge
 */
const DimensionBadge: React.FC<DimensionBadgeProps> = ({ type, label, tooltip }) => {
  const Icon = DIMENSION_ICONS[type] || Layers;
  const dimensionLabel = DIMENSION_LABELS[type] || type;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-primary/10 text-primary border border-primary/20',
        'text-sm font-medium'
      )}
      title={tooltip}
      role="status"
      aria-label={`${dimensionLabel}: ${label}`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="text-xs text-primary/70">{dimensionLabel}:</span>
      <span>{label}</span>
    </div>
  );
};

DimensionSummary.displayName = 'DimensionSummary';

export default DimensionSummary;
