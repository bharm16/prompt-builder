import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@promptstudio/system/lib/utils"

const panelVariants = cva("border border-border text-foreground", {
  variants: {
    surface: {
      "1": "bg-surface-1",
      "2": "bg-surface-2",
      "3": "bg-surface-3",
    },
    shadow: {
      none: "shadow-none",
      sm: "shadow-sm",
      elevated: "shadow-elevated",
      floating: "shadow-floating",
      inset: "shadow-inset",
    },
    radius: {
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      full: "rounded-full",
    },
    padding: {
      none: "p-0",
      sm: "p-ps-3",
      card: "p-ps-card",
      page: "p-ps-page",
    },
  },
  defaultVariants: {
    surface: "2",
    shadow: "sm",
    radius: "xl",
    padding: "card",
  },
})

export interface PanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof panelVariants> {
  asChild?: boolean
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, surface, shadow, radius, padding, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(panelVariants({ surface, shadow, radius, padding }), className)}
        {...props}
      />
    )
  }
)
Panel.displayName = "Panel"

export { Panel, panelVariants }
