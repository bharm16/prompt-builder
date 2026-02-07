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
 * - Header variant: 36×36 icon-only button (hamburger menu)
 * - Default variant: 44px wide, icon + 9px label, rounded-lg
 * - Active: white text + subtle bg (#1C1E26)
 * - Inactive: muted text (#555B6E), hover bg (#151720)
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
          'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
          isActive
            ? 'border-[#22252C] bg-[#1C1E26] text-[#E2E6EF]'
            : 'border-[#1A1C22] bg-transparent text-[#555B6E] hover:bg-[#151720] hover:text-[#8B92A5]'
        )}
        onClick={onClick}
        aria-label={label}
      >
        <IconComponent className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-11 flex-col items-center gap-[3px] rounded-lg py-[7px] transition-all',
        isActive
          ? 'bg-[#1C1E26] text-[#E2E6EF]'
          : 'bg-transparent text-[#555B6E] hover:bg-[#151720] hover:text-[#8B92A5]'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <IconComponent className="h-4 w-4" />
      <span className="text-[9px] font-medium tracking-[0.03em]">{label}</span>
    </button>
  );
}
