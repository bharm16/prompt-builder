import * as React from "react"

interface AppShellProps {
  sidebar?: React.ReactNode
  children: React.ReactNode
}

const AppShell = ({ sidebar, children }: AppShellProps) => {
  return (
    <div className="flex min-h-screen w-full bg-app text-foreground">
      {sidebar ? (
        <>
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-1">
            {sidebar}
          </aside>
          <main className="flex min-w-0 flex-1 flex-col bg-surface-2">
            {children}
          </main>
        </>
      ) : (
        <main className="flex min-w-0 flex-1 flex-col bg-surface-2">
          {children}
        </main>
      )}
    </div>
  )
}

export { AppShell }
export type { AppShellProps }
