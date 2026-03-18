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
 * - Active: brighter bg (tool-nav-active)
 * - Inactive: base bg (tool-nav-hover on hover)
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
          'relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3.5 py-3 text-left transition-[background-color,transform]',
          'duration-[160ms] [transition-timing-function:var(--motion-ease-emphasized)] hover:-translate-y-px',
          isActive
            ? 'bg-tool-nav-active text-foreground'
            : 'bg-transparent text-foreground hover:bg-tool-nav-hover hover:text-foreground'
        )}
        onClick={onClick}
        aria-label={label}
      >
        <span
          className={cn(
            'motion-active-pill absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-tool-nav-indicator',
            isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
          )}
          aria-hidden="true"
        />
        <IconComponent className="h-5 w-5 shrink-0" weight="bold" />
        <span className="text-body-sm font-semibold leading-none tracking-[0.02em]">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3.5 py-3 text-left transition-[background-color,transform]',
        'duration-[160ms] [transition-timing-function:var(--motion-ease-emphasized)] hover:-translate-y-px',
        isActive
          ? 'bg-tool-nav-active text-foreground'
          : 'bg-transparent text-foreground hover:bg-tool-nav-hover hover:text-foreground'
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
    >
      <span
        className={cn(
          'motion-active-pill absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-tool-nav-indicator',
          isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
        )}
        aria-hidden="true"
      />
      <IconComponent className="h-5 w-5 shrink-0" weight="bold" />
      <span className="text-body-sm font-semibold leading-none tracking-[0.02em]">{label}</span>
    </button>
  );
}
