import * as React from "react"

import { cn } from "@promptstudio/system/lib/utils"

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoResize = false,
      onInput,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const localRef = React.useRef<HTMLTextAreaElement | null>(null)

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        localRef.current = node
        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ;(ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
        }
      },
      [ref]
    )

    const resize = React.useCallback(() => {
      if (!autoResize) return
      const element = localRef.current
      if (!element) return
      element.style.height = "auto"
      element.style.height = `${element.scrollHeight}px`
    }, [autoResize])

    React.useEffect(() => {
      resize()
    }, [resize, value, defaultValue])

    const handleInput = React.useCallback(
      (event: React.FormEvent<HTMLTextAreaElement>) => {
        if (autoResize) {
          resize()
        }
        onInput?.(event)
      },
      [autoResize, onInput, resize]
    )

    return (
      <textarea
        className={cn(
          "flex min-h-ps-11 w-full rounded-lg border border-border bg-surface-1 px-ps-3 py-ps-2 text-body text-foreground placeholder:text-faint placeholder:text-label-sm placeholder:font-medium focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
          autoResize ? "resize-none" : "resize-y",
          className
        )}
        onInput={handleInput}
        ref={setRefs}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
export type { TextareaProps }
