import React from 'react';

interface ImagePromptOverlayProps {
  isVisible: boolean;
  onAddReferences: () => void;
  onSketch?: () => void;
}

export function ImagePromptOverlay({
  isVisible,
  onAddReferences,
  onSketch,
}: ImagePromptOverlayProps): React.ReactElement | null {
  if (!isVisible) return null;

  return (
    <span className="absolute top-3 left-3 text-base leading-6 text-[#7C839C]">
      Describe your shot,{' '}
      <button
        type="button"
        className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
        onClick={onAddReferences}
      >
        add image references
      </button>
      , or{' '}
      <button
        type="button"
        className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
        onClick={onSketch}
      >
        sketch a scene
      </button>
      .
    </span>
  );
}
