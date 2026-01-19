import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"
import { panelVariants } from "./Panel"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      panelVariants({ surface: "1", shadow: "elevated", radius: "xl", padding: "none" }),
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
