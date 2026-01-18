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
          "flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
