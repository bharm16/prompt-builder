import type { ReactElement } from "react";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { cn } from "@utils/cn";

/** Phosphor icon component (not the wrapped Icon from our design system). */
type PhosphorIcon = ComponentType<PhosphorIconProps>;

interface ToolNavButtonProps {
  icon: PhosphorIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: "header" | "default";
}

/**
 * Rail navigation button — compact 40px square icon button.
 *
 * - Active: violet-tinted bg, filled icon
 * - Inactive: muted text, regular icon weight
 * - Label shown via native `title` tooltip
 */
export function ToolNavButton({
  icon: IconComponent,
  label,
  isActive,
  onClick,
}: ToolNavButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
        isActive
          ? "bg-tool-nav-active text-foreground"
          : "text-tool-text-muted hover:bg-tool-nav-hover hover:text-foreground",
      )}
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
    >
      <span
        className={cn(
          "motion-active-pill absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-tool-nav-indicator",
          isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50",
        )}
        aria-hidden="true"
      />
      <IconComponent size={20} weight={isActive ? "fill" : "regular"} />
    </button>
  );
}
