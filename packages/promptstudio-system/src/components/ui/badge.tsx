import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@promptstudio/system/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-border font-semibold",
  {
    variants: {
      variant: {
        surface: "bg-surface-2 text-foreground",
        subtle: "bg-surface-3 text-muted",
        outline: "bg-transparent text-foreground",
      },
      size: {
        xs: "gap-ps-1 px-ps-1 py-0.5 text-label-10",
        sm: "gap-ps-1 px-ps-2 py-ps-1 text-label-11",
        default: "gap-ps-2 px-ps-2 py-ps-1 text-label-sm",
        md: "gap-ps-2 px-ps-3 py-ps-1 text-label-12",
        lg: "gap-ps-2 px-ps-3 py-ps-2 text-label-14",
      },
      casing: {
        none: "",
        upper: "uppercase tracking-wide",
      },
    },
    defaultVariants: {
      variant: "surface",
      size: "default",
      casing: "none",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, casing, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, casing }), className)}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
