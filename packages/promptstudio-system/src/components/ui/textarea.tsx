import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean
  errorMessage?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, errorMessage, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-ps-1">
        <textarea
          className={cn(
            "flex min-h-ps-11 w-full rounded-lg border border-border bg-surface-1 px-ps-3 py-ps-2 text-body text-foreground placeholder:text-faint placeholder:text-label-sm placeholder:font-medium focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-danger focus-visible:border-danger",
            className
          )}
          ref={ref}
          aria-invalid={error || undefined}
          aria-describedby={error && errorMessage ? `${props.id ?? props.name}-error` : undefined}
          {...props}
        />
        {error && errorMessage ? (
          <p
            id={`${props.id ?? props.name}-error`}
            className="text-label-sm text-danger"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
