import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@utils/cn';

interface ToolNavButtonProps {
  icon: LucideIcon;
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
          'w-11 h-[34px] px-1.5 py-px flex flex-col items-center gap-1',
          'cursor-pointer'
        )}
        onClick={onClick}
        aria-label={label}
      >
        <Icon className="w-4 h-4 text-[#A1AFC5]" />
        <span className="text-[11px] font-medium text-[#A1AFC5]">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'w-10 h-[50px] px-1.5 py-px flex flex-col items-center gap-1',
        'cursor-pointer'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          isActive ? 'bg-[#2C3037]' : 'bg-transparent'
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5 stroke-[1.2px]',
            isActive ? 'text-white' : 'text-[#A1AFC5]'
          )}
        />
      </div>
      <span
        className={cn(
          'text-[11px] font-medium',
          isActive ? 'text-white' : 'text-[#A1AFC5]'
        )}
      >
        {label}
      </span>
    </button>
  );
}
