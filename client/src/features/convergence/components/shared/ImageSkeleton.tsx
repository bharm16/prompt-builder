/**
 * ImageSkeleton Component
 *
 * Animated placeholder displayed during image loading in the convergence flow.
 * Shows a pulsing skeleton with an aspect ratio matching the generated images.
 *
 * @requirement 12.1 - Responsive grid display
 */

import React from 'react';
import { cn } from '@/utils/cn';

export interface ImageSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Aspect ratio of the skeleton (default: 'square') */
  aspectRatio?: 'square' | 'video' | '4:3';
  /** Whether to show a shimmer animation */
  shimmer?: boolean;
  /** Accessible label for screen readers */
  'aria-label'?: string;
}

/**
 * ImageSkeleton - Animated placeholder for loading images
 */
export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({
  className,
  aspectRatio = 'square',
  shimmer = true,
  'aria-label': ariaLabel = 'Loading image...',
}) => {
  const aspectRatioClasses: Record<string, string> = {
    square: 'aspect-square',
    video: 'aspect-video',
    '4:3': 'aspect-[4/3]',
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'relative overflow-hidden rounded-lg bg-surface-2 border border-border',
        aspectRatioClasses[aspectRatio],
        shimmer && 'animate-pulse',
        className
      )}
    >
      {/* Shimmer overlay effect */}
      {shimmer && (
        <div
          className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"
          aria-hidden="true"
        />
      )}

      {/* Center icon placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="h-10 w-10 text-muted/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Screen reader text */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
};

ImageSkeleton.displayName = 'ImageSkeleton';

export default ImageSkeleton;
