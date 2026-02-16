import React from 'react';
import type { GalleryGeneration } from './types';

interface GalleryThumbnailProps {
  generation: GalleryGeneration;
  isActive: boolean;
  onClick: () => void;
}

export function GalleryThumbnail({
  generation,
  isActive,
  onClick,
}: GalleryThumbnailProps): React.ReactElement {
  const thumbnailUrl = generation.thumbnailUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-[105px] w-full flex-shrink-0 overflow-hidden rounded-[10px] border-2 transition-opacity ${
        isActive
          ? 'border-[#3A3D46] opacity-100'
          : 'border-transparent opacity-75 hover:border-[#3A3D46] hover:opacity-100'
      }`}
      aria-label="Open generation details"
      data-testid={`gallery-thumbnail-${generation.id}`}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#1A1C22] to-[#0D0E12]" />
      )}
    </button>
  );
}

