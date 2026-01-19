"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cva, type VariantProps } from "class-variance-authority"
import { CaretDown, CaretUp, Check } from "./icons"

import { cn } from "@promptstudio/system/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const selectTriggerVariants = cva(
  "flex w-full items-center justify-between border bg-surface-1 text-foreground transition-colors data-[placeholder]:text-faint focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
  {
    variants: {
      size: {
        xs: "h-ps-6 gap-ps-1 px-ps-2 text-label-11 rounded-md [&>svg]:size-3",
        sm: "h-ps-7 gap-ps-1 px-ps-2 text-label-12 rounded-lg [&>svg]:size-3.5",
        default: "h-ps-8 gap-ps-2 px-ps-3 py-ps-2 text-body rounded-lg",
        md: "h-ps-8 gap-ps-2 px-ps-3 py-ps-2 text-body rounded-lg",
        lg: "h-ps-9 gap-ps-2 px-ps-4 py-ps-2 text-body-lg rounded-lg",
      },
      variant: {
        default: "border-border hover:border-border-strong",
        ghost: "border-transparent bg-transparent hover:bg-surface-2 hover:border-border",
        pill: "border-border bg-surface-2 rounded-full hover:border-border-strong hover:bg-surface-3",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

const selectItemVariants = cva(
  "relative flex w-full cursor-default select-none items-center outline-none focus:bg-surface-3 focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  {
    variants: {
      size: {
        xs: "rounded py-ps-1 pl-ps-6 pr-ps-2 text-label-11 [&_.item-indicator]:left-ps-1 [&_.item-indicator]:size-icon-xs",
        sm: "rounded-md py-ps-1 pl-ps-6 pr-ps-2 text-label-12 [&_.item-indicator]:left-ps-1 [&_.item-indicator]:size-icon-xs",
        default: "rounded-md py-ps-1 pl-ps-7 pr-ps-2 text-body-sm [&_.item-indicator]:left-ps-2 [&_.item-indicator]:size-icon-sm",
        md: "rounded-md py-ps-1 pl-ps-7 pr-ps-2 text-body-sm [&_.item-indicator]:left-ps-2 [&_.item-indicator]:size-icon-sm",
        lg: "rounded-md py-ps-2 pl-ps-8 pr-ps-3 text-body [&_.item-indicator]:left-ps-2 [&_.item-indicator]:size-icon-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

// Context to pass size down to SelectItem
type SelectContextValue = {
  size?: "xs" | "sm" | "default" | "md" | "lg"
}
const SelectContext = React.createContext<SelectContextValue>({})

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size, variant, ...props }, ref) => (
  <SelectContext.Provider value={{ size: size ?? "default" }}>
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(selectTriggerVariants({ size, variant }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown className="shrink-0 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  </SelectContext.Provider>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-ps-1",
      className
    )}
    {...props}
  >
    <CaretUp size={16} />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-ps-1",
      className
    )}
    {...props}
  >
    <CaretDown size={16} />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-surface-2 text-foreground shadow-elevated data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-ps-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-ps-1 pl-ps-7 pr-ps-2 text-body-sm font-semibold text-foreground", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>,
    VariantProps<typeof selectItemVariants> {}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, size: sizeProp, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  const size = sizeProp ?? context.size ?? "default"
  const iconSize = size === "xs" || size === "sm" ? 12 : 16
  
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(selectItemVariants({ size }), className)}
      {...props}
    >
      <span className="item-indicator absolute flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={iconSize} />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-ps-1 my-ps-1 h-px bg-border", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  selectTriggerVariants,
  selectItemVariants,
}
