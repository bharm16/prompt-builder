import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@promptstudio/system/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-ps-2 whitespace-nowrap rounded-sm text-button-14 font-medium ps-edge-lit transition-colors disabled:pointer-events-none disabled:opacity-50 ps-press [&_svg]:pointer-events-none [&_svg]:size-icon-sm [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110",
        outline:
          "border border-border bg-transparent text-muted hover:border-border-strong hover:bg-surface-3 hover:text-foreground",
        secondary:
          "border border-border bg-surface-2 text-foreground hover:bg-surface-3",
        ghost: "bg-transparent text-muted hover:bg-surface-3 hover:text-foreground",
        canvas:
          "border border-transparent bg-transparent text-muted hover:border-border hover:bg-surface-3 hover:text-foreground",
        "canvas-solid":
          "border border-border bg-surface-2 text-foreground hover:border-border-strong hover:bg-surface-3",
        gradient:
          "border border-border bg-gradient-to-r from-accent to-accent-2 text-app shadow-md transition-transform hover:-translate-y-px disabled:hover:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-ps-6 px-ps-2 text-button-11",
        sm: "h-ps-6 px-ps-3 text-button-12",
        default: "h-ps-6 px-ps-4",
        md: "h-ps-6 px-ps-4",
        lg: "h-ps-9 px-ps-6 text-button-16",
        xl: "h-ps-10 px-ps-7 text-button-16",
        icon: "h-ps-8 w-ps-8 px-0",
        "icon-xs": "h-ps-8 w-ps-8 px-0 [&_svg]:size-icon-xs",
        "icon-sm": "h-ps-8 w-ps-8 px-0",
        "icon-lg": "h-ps-8 w-ps-8 px-0 [&_svg]:size-icon-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
