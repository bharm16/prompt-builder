import type { ReactElement } from 'react';
import type { IconProps as PhosphorIconProps } from '@phosphor-icons/react';
import type { ComponentType } from 'react';
import { cn } from '@utils/cn';

/** Phosphor icon component (not the wrapped Icon from our design system). */
type PhosphorIcon = ComponentType<PhosphorIconProps>;

interface ToolNavButtonProps {
  icon: PhosphorIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: 'header' | 'default';
}

/**
 * Rail navigation button matching v5 mockup.
 *
 * - Header variant: full-width row button
 * - Default variant: full-width row button, icon + label
 * - Active: brighter bg (#22252C)
 * - Inactive: base bg (#1C1E26)
 */
export function ToolNavButton({
  icon: IconComponent,
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
          'flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-colors',
          isActive
            ? 'bg-[#22252C] text-[#E2E6EF]'
            : 'bg-transparent text-[#E2E6EF] hover:bg-[#1C1E26] hover:text-[#E2E6EF]'
        )}
        onClick={onClick}
        aria-label={label}
      >
        <IconComponent className="h-5 w-5 shrink-0" weight="bold" />
        <span className="text-[13px] font-semibold leading-none tracking-[0.02em]">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left transition-colors',
        isActive
          ? 'bg-[#22252C] text-[#E2E6EF]'
          : 'bg-transparent text-[#E2E6EF] hover:bg-[#1C1E26] hover:text-[#E2E6EF]'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <IconComponent className="h-5 w-5 shrink-0" weight="bold" />
      <span className="text-[13px] font-semibold leading-none tracking-[0.02em]">{label}</span>
    </button>
  );
}
