import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-ps-8 w-full rounded-lg border border-border bg-surface-1 px-ps-3 py-ps-2 text-body text-foreground file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground placeholder:text-faint focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
