import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@promptstudio/system/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-ps-4 py-ps-3 text-body-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-ps-4 [&>svg]:top-ps-4 [&>svg]:text-foreground [&>svg~*]:pl-ps-7",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-1 text-foreground",
        info: "border-info/30 bg-info/5 text-foreground [&>svg]:text-info",
        success: "border-success/30 bg-success/5 text-foreground [&>svg]:text-success",
        warning: "border-warning/30 bg-warning/5 text-foreground [&>svg]:text-warning",
        error: "border-danger/30 bg-danger/5 text-foreground [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-ps-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-body-sm text-muted [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
