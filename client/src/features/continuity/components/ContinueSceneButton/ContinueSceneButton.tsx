import React from "react";

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
  label = "Continue Scene",
}: ContinueSceneButtonProps): React.ReactElement {
  return (
    <div className={className}>
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs font-medium ${
          disabled || isLoading
            ? "border border-tool-nav-active bg-transparent text-tool-text-label cursor-not-allowed"
            : "border border-tool-nav-active bg-transparent text-tool-text-subdued hover:border-tool-text-disabled hover:text-tool-text-dim"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        disabled={disabled || isLoading}
      >
        {isLoading ? "Starting..." : label}
      </button>
    </div>
  );
}

export default ContinueSceneButton;
