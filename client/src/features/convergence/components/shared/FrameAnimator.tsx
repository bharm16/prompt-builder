/**
 * FrameAnimator Component
 *
 * React component wrapper for animating pre-rendered frames using requestAnimationFrame.
 * Used for camera motion preview playback in the Visual Convergence flow.
 *
 * Requirements:
 * - 6.4: Play preview animation on hover
 * - 6.6: Animate frames directly with requestAnimationFrame (Safari compatibility)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createFrameAnimator, type FrameAnimatorControls } from '@/features/convergence/utils/cameraMotionRenderer';

// ============================================================================
// Types
// ============================================================================

export interface FrameAnimatorProps {
  /** Array of frame data URLs to animate */
  frames: string[];
  /** Frames per second for playback (default: 15) */
  fps?: number;
  /** Whether to auto-play on mount (default: true) */
  autoPlay?: boolean;
  /** Whether to loop the animation (default: true) */
  loop?: boolean;
  /** CSS class name for the container */
  className?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Callback when animation starts */
  onStart?: () => void;
  /** Callback when animation stops */
  onStop?: () => void;
  /** Callback when animation completes a loop */
  onLoopComplete?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FrameAnimator renders a sequence of frames as an animation
 *
 * Uses requestAnimationFrame for smooth, Safari-compatible animation.
 * Automatically starts playing when mounted (if autoPlay is true).
 * Cleans up animation on unmount to prevent memory leaks.
 */
export const FrameAnimator: React.FC<FrameAnimatorProps> = ({
  frames,
  fps = 15,
  autoPlay = true,
  loop = true,
  className = '',
  alt = 'Camera motion preview',
  onStart,
  onStop,
  onLoopComplete,
}) => {
  // Current frame being displayed
  const [currentFrame, setCurrentFrame] = useState<string | null>(frames[0] || null);

  // Track if animation is playing
  const [isPlaying, setIsPlaying] = useState(false);

  // Animator controls ref
  const animatorRef = useRef<FrameAnimatorControls | null>(null);

  // Track frame index for loop detection
  const frameIndexRef = useRef(0);
  const totalFrames = frames.length;

  /**
   * Handle frame updates from the animator
   */
  const handleFrame = useCallback(
    (frameDataUrl: string) => {
      setCurrentFrame(frameDataUrl);

      // Track frame index for loop detection
      const frameIndex = frames.indexOf(frameDataUrl);
      if (frameIndex !== -1) {
        // Check if we've completed a loop (went from last frame back to first)
        if (frameIndexRef.current === totalFrames - 1 && frameIndex === 0) {
          onLoopComplete?.();

          // If not looping, stop after first complete cycle
          if (!loop && animatorRef.current) {
            animatorRef.current.stop();
            setIsPlaying(false);
            onStop?.();
          }
        }
        frameIndexRef.current = frameIndex;
      }
    },
    [frames, totalFrames, loop, onLoopComplete, onStop]
  );

  /**
   * Initialize animator when frames change
   */
  useEffect(() => {
    if (frames.length === 0) return;

    // Create new animator
    animatorRef.current = createFrameAnimator(frames, fps, handleFrame);

    // Auto-play if enabled
    if (autoPlay) {
      animatorRef.current.start();
      setIsPlaying(true);
      onStart?.();
    }

    // Cleanup on unmount or when frames change
    return () => {
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, [frames, fps, autoPlay, handleFrame, onStart]);

  /**
   * Start the animation
   */
  const start = useCallback(() => {
    if (animatorRef.current && !isPlaying) {
      frameIndexRef.current = 0;
      animatorRef.current.start();
      setIsPlaying(true);
      onStart?.();
    }
  }, [isPlaying, onStart]);

  /**
   * Stop the animation
   */
  const stop = useCallback(() => {
    if (animatorRef.current && isPlaying) {
      animatorRef.current.stop();
      setIsPlaying(false);
      onStop?.();
    }
  }, [isPlaying, onStop]);

  /**
   * Toggle play/pause
   */
  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  }, [isPlaying, start, stop]);

  // Don't render if no frames
  if (frames.length === 0 || !currentFrame) {
    return null;
  }

  return (
    <img
      src={currentFrame}
      alt={alt}
      className={`w-full h-full object-cover ${className}`}
      // Expose controls via data attributes for testing
      data-playing={isPlaying}
      data-frame-count={frames.length}
      // Click to toggle (optional interaction)
      onClick={toggle}
    />
  );
};

// ============================================================================
// Hook for External Control
// ============================================================================

/**
 * Hook for controlling FrameAnimator externally
 *
 * Returns controls that can be passed to FrameAnimator or used independently.
 */
export function useFrameAnimator(
  frames: string[],
  fps: number = 15
): {
  currentFrame: string | null;
  isPlaying: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
} {
  const [currentFrame, setCurrentFrame] = useState<string | null>(frames[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animatorRef = useRef<FrameAnimatorControls | null>(null);

  useEffect(() => {
    if (frames.length === 0) return;

    animatorRef.current = createFrameAnimator(frames, fps, setCurrentFrame);

    return () => {
      if (animatorRef.current) {
        animatorRef.current.stop();
        animatorRef.current = null;
      }
    };
  }, [frames, fps]);

  const start = useCallback(() => {
    if (animatorRef.current && !isPlaying) {
      animatorRef.current.start();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const stop = useCallback(() => {
    if (animatorRef.current && isPlaying) {
      animatorRef.current.stop();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      start();
    }
  }, [isPlaying, start, stop]);

  return {
    currentFrame,
    isPlaying,
    start,
    stop,
    toggle,
  };
}

export default FrameAnimator;
