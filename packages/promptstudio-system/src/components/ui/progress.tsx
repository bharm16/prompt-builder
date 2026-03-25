import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@promptstudio/system/lib/utils";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-surface-2",
  {
    variants: {
      size: {
        sm: "h-1",
        default: "h-2",
        lg: "h-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const progressIndicatorVariants = cva(
  "h-full rounded-full transition-[width] duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "bg-accent",
        success: "bg-success",
        warning: "bg-warning",
        error: "bg-danger",
        accent: "bg-accent-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof progressIndicatorVariants> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      size,
      variant,
      indeterminate = false,
      ...props
    },
    ref,
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(progressVariants({ size }), className)}
        {...props}
      >
        <div
          className={cn(
            progressIndicatorVariants({ variant }),
            indeterminate &&
              "animate-[progress-indeterminate_1.5s_ease-in-out_infinite] w-1/3",
          )}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress, progressVariants, progressIndicatorVariants };
