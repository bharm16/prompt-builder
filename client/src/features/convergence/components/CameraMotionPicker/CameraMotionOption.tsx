/**
 * CameraMotionOption Component
 *
 * Individual camera motion option with Three.js preview on hover (normal mode)
 * or text description (fallback mode).
 *
 * Features:
 * - Normal mode: Three.js preview with lazy render on hover
 * - Fallback mode: text description from CAMERA_MOTION_DESCRIPTIONS
 * - Loading spinner during frame rendering
 * - Selected state indicator
 * - Keyboard focus support
 *
 * @requirement 6.4 - Play preview animation on hover
 * @requirement 6.5 - Render camera path previews lazily on hover
 * @requirement 12.5-12.6 - Keyboard navigation with visible focus indicators
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { logger } from '@/services/LoggingService';
import { cn } from '@/utils/cn';
import { renderCameraMotionFrames } from '@/features/convergence/utils/cameraMotionRenderer';
import type { CameraPath } from '@/features/convergence/types';
import { FrameAnimator } from '../shared/FrameAnimator';

// ============================================================================
// Constants
// ============================================================================

/**
 * Text descriptions for camera motions used in fallback mode
 * When depth estimation fails, these descriptions help users understand each motion
 */
export const CAMERA_MOTION_DESCRIPTIONS: Record<string, string> = {
  static: 'Camera remains fixed. Best for dialogue or contemplative scenes.',
  pan_left: 'Camera rotates left while staying in place. Reveals new elements.',
  pan_right: 'Camera rotates right while staying in place. Reveals new elements.',
  tilt_up: 'Camera tilts upward. Reveals height or creates awe.',
  tilt_down: 'Camera tilts downward. Creates introspection or reveals ground.',
  dutch_left: 'Camera rolls left for tilted horizon. Adds tension or unease.',
  dutch_right: 'Camera rolls right for tilted horizon. Adds tension or unease.',
  push_in: 'Camera moves toward subject. Creates intimacy or tension.',
  pull_back: 'Camera moves away from subject. Reveals context or creates distance.',
  track_left: 'Camera slides left. Follows action or reveals scene laterally.',
  track_right: 'Camera slides right. Follows action or reveals scene laterally.',
  pedestal_up: 'Camera rises vertically. Reveals overhead perspective.',
  pedestal_down: 'Camera lowers vertically. Grounds the viewer.',
  crane_up: 'Camera rises with subtle tilt. Creates grandeur.',
  crane_down: 'Camera descends with subtle tilt. Creates intimacy.',
  arc_left: 'Camera orbits left around subject. Dynamic perspective shift.',
  arc_right: 'Camera orbits right around subject. Dynamic perspective shift.',
  reveal: 'Combined push and pan. Builds anticipation for dramatic reveal.',
};

// ============================================================================
// Types
// ============================================================================

export interface CameraMotionOptionProps {
  /** Camera path configuration */
  cameraPath: CameraPath;
  /** Source image URL for Three.js rendering */
  imageUrl: string;
  /** Depth map URL for Three.js rendering (null in fallback mode) */
  depthMapUrl: string | null;
  /** Whether this option is currently selected */
  isSelected?: boolean;
  /** Whether this option is currently focused (keyboard navigation) */
  isFocused?: boolean;
  /** Whether the component is in fallback mode (no depth map) */
  fallbackMode?: boolean;
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Callback when the option is selected */
  onSelect?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * CameraMotionOption - Individual camera motion option with preview
 *
 * In normal mode, renders Three.js preview on hover.
 * In fallback mode, shows text description.
 */
const log = logger.child('CameraMotionOption');

export const CameraMotionOption: React.FC<CameraMotionOptionProps> = ({
  cameraPath,
  imageUrl,
  depthMapUrl,
  isSelected = false,
  isFocused = false,
  fallbackMode = false,
  disabled = false,
  onSelect,
  className,
  tabIndex = 0,
}) => {
  // State for lazy rendering
  const [frames, setFrames] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Ref to track if component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Render frames lazily on hover (Task 23.2.1)
   * Requirement 6.5: Render camera path previews lazily on hover
   */
  const renderFrames = useCallback(async () => {
    // Skip if already rendered, rendering, in fallback mode, or no depth map
    if (hasRendered || isRendering || fallbackMode || !depthMapUrl) {
      return;
    }

    setIsRendering(true);
    setRenderError(false);

    try {
      const renderedFrames = await renderCameraMotionFrames(
        imageUrl,
        depthMapUrl,
        cameraPath,
        {
          width: 320,
          height: 180,
          fps: 15,
        }
      );

      if (isMountedRef.current) {
        setFrames(renderedFrames);
        setHasRendered(true);
      }
    } catch (error) {
      log.warn('Failed to render camera motion frames', {
        cameraMotionId: cameraPath.id,
        error: error instanceof Error ? error.message : String(error),
      });
      if (isMountedRef.current) {
        setRenderError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRendering(false);
      }
    }
  }, [hasRendered, isRendering, fallbackMode, depthMapUrl, imageUrl, cameraPath]);

  /**
   * Handle mouse enter - trigger lazy render
   */
  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    if (!fallbackMode && !hasRendered && !isRendering) {
      renderFrames();
    }
  }, [fallbackMode, hasRendered, isRendering, renderFrames]);

  /**
   * Handle mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  /**
   * Handle focus - also trigger lazy render for keyboard navigation
   */
  const handleFocus = useCallback(() => {
    if (!fallbackMode && !hasRendered && !isRendering) {
      renderFrames();
    }
  }, [fallbackMode, hasRendered, isRendering, renderFrames]);

  /**
   * Handle click selection
   */
  const handleClick = useCallback(() => {
    if (!disabled && onSelect) {
      onSelect(cameraPath.id);
    }
  }, [disabled, onSelect, cameraPath.id]);

  /**
   * Handle keyboard selection
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled && onSelect) {
        e.preventDefault();
        onSelect(cameraPath.id);
      }
    },
    [disabled, onSelect, cameraPath.id]
  );

  // Determine if we should show the animation
  const showAnimation = !fallbackMode && hasRendered && frames.length > 0 && isHovering;
  const showFallbackText = fallbackMode || renderError;

  // Touch-friendly tap targets: min 44px (Task 35.4)
  // Camera motion options are naturally larger than 44px due to aspect-video
  const minTouchTarget = 'min-h-[44px] min-w-[44px]';

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${cameraPath.label}${isSelected ? ' (selected)' : ''}`}
      tabIndex={tabIndex}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      className={cn(
        'group relative overflow-hidden rounded-lg border-2 transition-all duration-200',
        'aspect-video',
        minTouchTarget,
        // Base state
        'bg-surface-2 border-border',
        // Hover state
        !disabled && !isSelected && 'hover:border-primary/50 hover:shadow-md',
        // Focus state (keyboard navigation) - Requirement 36.2
        isFocused && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background',
        // Selected state (Task 23.4)
        isSelected && 'border-primary ring-2 ring-primary/30',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed',
        // Cursor
        !disabled && 'cursor-pointer',
        className
      )}
    >
      {/* Preview Content */}
      <div className="absolute inset-0">
        {/* Normal mode: Three.js preview (Task 23.2.1) */}
        {!showFallbackText && (
          <>
            {/* Static image when not hovering or not yet rendered */}
            {!showAnimation && (
              <img
                src={imageUrl}
                alt={cameraPath.label}
                className="h-full w-full object-cover"
              />
            )}

            {/* Animated preview on hover */}
            {showAnimation && (
              <FrameAnimator
                frames={frames}
                fps={15}
                autoPlay={true}
                loop={true}
                alt={`${cameraPath.label} camera motion preview`}
                className="h-full w-full object-cover"
              />
            )}

            {/* Loading spinner during frame rendering (Task 23.3) */}
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </>
        )}

        {/* Fallback mode: text description (Task 23.2.2) */}
        {showFallbackText && (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
            <div className="text-lg font-medium text-foreground mb-2">
              {cameraPath.label}
            </div>
            <div className="text-sm text-muted line-clamp-3">
              {CAMERA_MOTION_DESCRIPTIONS[cameraPath.id] || 'Camera motion preview'}
            </div>
          </div>
        )}
      </div>

      {/* Label overlay (only in normal mode) */}
      {!showFallbackText && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8',
            'transition-opacity duration-200'
          )}
        >
          <span className="text-sm font-medium text-white drop-shadow-sm">
            {cameraPath.label}
          </span>
        </div>
      )}

      {/* Selected indicator (Task 23.4) */}
      {isSelected && (
        <div
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          aria-hidden="true"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </div>
      )}

      {/* Hover overlay */}
      {!disabled && !isSelected && (
        <div
          className="absolute inset-0 bg-primary/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

CameraMotionOption.displayName = 'CameraMotionOption';

export default CameraMotionOption;
