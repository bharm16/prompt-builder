import React from 'react';

interface ContinueSceneButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  label?: string;
}

export function ContinueSceneButton({
  onClick,
  disabled = false,
  isLoading = false,
  className,
  label = 'Continue Scene',
}: ContinueSceneButtonProps): React.ReactElement {
  return (
    <div className={className}>
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          disabled || isLoading
            ? 'border border-[#22252C] bg-transparent text-[#3A3E4C] cursor-not-allowed'
            : 'border border-[#22252C] bg-transparent text-[#555B6E] hover:border-[#3A3D46] hover:text-[#8B92A5]'
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        disabled={disabled || isLoading}
      >
        {isLoading ? 'Starting...' : label}
      </button>
    </div>
  );
}

export default ContinueSceneButton;
