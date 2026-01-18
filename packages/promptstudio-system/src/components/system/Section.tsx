import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@promptstudio/system/lib/utils"

interface SectionProps {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}

const Section = ({ title, action, children }: SectionProps) => {
  const [isOpen, setIsOpen] = React.useState(true)
  const contentId = React.useId()

  return (
    <section className="rounded-lg border border-border bg-surface-1 shadow-elevated">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((prev) => !prev)}
          className="group flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted transition-transform duration-fast ease-out",
              isOpen ? "rotate-90" : "rotate-0"
            )}
          />
          <span className="ps-h5 text-foreground">{title}</span>
        </button>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      <div id={contentId} className="px-6 pb-6" hidden={!isOpen}>
        {children}
      </div>
    </section>
  )
}

export { Section }
export type { SectionProps }
