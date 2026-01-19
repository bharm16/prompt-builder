import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-ps-11 w-full rounded-lg border border-border bg-surface-1 px-ps-3 py-ps-2 text-body text-foreground placeholder:text-faint focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
