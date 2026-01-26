/**
 * ImageGrid Component
 *
 * Responsive grid layout for displaying image options.
 * Shows 2 columns on mobile, 4 columns on desktop.
 * Handles loading and loaded states with skeleton placeholders.
 *
 * @requirement 12.1 - Responsive grid (2 columns on mobile, 4 on desktop)
 * @requirement 35.1 - Ensure 2-column grid on mobile, 4-column on desktop for images
 */

import React from 'react';
import { cn } from '@/utils/cn';
import { ImageSkeleton } from './ImageSkeleton';
import { ImageOption, type ImageOptionProps } from './ImageOption';
import type { GeneratedImage } from '../../types';

export interface ImageGridProps {
  /** Array of generated images to display */
  images: GeneratedImage[];
  /** Array of options with labels */
  options: Array<{ id: string; label: string }>;
  /** Currently selected option ID */
  selectedId?: string | null;
  /** Currently focused option index (for keyboard navigation) */
  focusedIndex?: number;
  /** Whether the grid is in loading state */
  isLoading?: boolean;
  /** Number of skeleton items to show when loading */
  skeletonCount?: number;
  /** Callback when an option is selected */
  onSelect?: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Aspect ratio for images */
  aspectRatio?: ImageOptionProps['aspectRatio'];
  /** Whether options are disabled */
  disabled?: boolean;
}

/**
 * ImageGrid - Responsive grid for image options with loading states
 */
export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  options,
  selectedId,
  focusedIndex = -1,
  isLoading = false,
  skeletonCount = 4,
  onSelect,
  className,
  aspectRatio = 'square',
  disabled = false,
}) => {
  // Create a map of option ID to image for quick lookup
  const imageMap = React.useMemo(() => {
    const map = new Map<string, GeneratedImage>();
    images.forEach((img) => {
      map.set(img.optionId, img);
    });
    return map;
  }, [images]);

  return (
    <div
      role="listbox"
      aria-label="Image options"
      className={cn(
        // Responsive grid: 2 columns on mobile, 4 on desktop
        'grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4',
        className
      )}
    >
      {isLoading ? (
        // Loading state: show skeletons
        Array.from({ length: skeletonCount }).map((_, index) => (
          <ImageSkeleton
            key={`skeleton-${index}`}
            aspectRatio={aspectRatio}
            aria-label={`Loading option ${index + 1}...`}
          />
        ))
      ) : (
        // Loaded state: show image options
        options.map((option, index) => {
          const image = imageMap.get(option.id);
          return (
            <ImageOption
              key={option.id}
              id={option.id}
              imageUrl={image?.url || ''}
              label={option.label}
              isSelected={selectedId === option.id}
              isFocused={focusedIndex === index}
              disabled={disabled || !image?.url}
              onSelect={onSelect}
              aspectRatio={aspectRatio}
              tabIndex={focusedIndex === index ? 0 : -1}
            />
          );
        })
      )}
    </div>
  );
};

ImageGrid.displayName = 'ImageGrid';

export default ImageGrid;
