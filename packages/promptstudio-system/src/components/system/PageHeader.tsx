import * as React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border bg-surface-1 px-8 py-6">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="ps-h2 text-foreground">{title}</h1>
        {description ? (
          <p className="ps-body-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

export { PageHeader }
export type { PageHeaderProps }
