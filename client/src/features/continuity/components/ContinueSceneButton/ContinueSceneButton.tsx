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
            ? 'bg-surface-3 text-muted cursor-not-allowed'
            : 'bg-accent text-white'
        }`}
        onClick={onClick}
        disabled={disabled || isLoading}
      >
        {isLoading ? 'Starting...' : label}
      </button>
    </div>
  );
}

export default ContinueSceneButton;
