import type { ReactElement } from 'react';
import type { AppIcon } from '@/types';
import { cn } from '@utils/cn';

interface ToolNavButtonProps {
  icon: AppIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: 'header' | 'default';
}

export function ToolNavButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  variant = 'default',
}: ToolNavButtonProps): ReactElement {
  if (variant === 'header') {
    return (
      <button
        type="button"
        className={cn(
          'w-11 h-[34px] px-1.5 py-px flex flex-col items-center justify-center gap-1',
          'cursor-pointer'
        )}
        onClick={onClick}
        aria-label={label}
      >
        <Icon className="w-4 h-4 text-[#A1AFC5]" />
        <span className="text-[11px] leading-none font-medium text-[#A1AFC5]">
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'w-11 h-[34px] px-1.5 py-px flex flex-col items-center justify-center gap-1',
        'cursor-pointer'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon
        className={cn(
          'w-4 h-4 stroke-[1.2px]',
          isActive ? 'text-white' : 'text-[#A1AFC5]'
        )}
      />
      <span
        className={cn(
          'text-[11px] leading-none font-medium',
          isActive ? 'text-white' : 'text-[#A1AFC5]'
        )}
      >
        {label}
      </span>
    </button>
  );
}
