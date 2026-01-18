import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-surface-1 text-foreground shadow-elevated",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
