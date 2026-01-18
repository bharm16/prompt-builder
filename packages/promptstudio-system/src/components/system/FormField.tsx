import * as React from "react"

interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}

const FormField = ({ label, hint, error, children }: FormFieldProps) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="ps-label text-foreground">{label}</span>
      <div className="flex flex-col gap-2">
        {children}
        {error ? (
          <p className="ps-meta text-danger">{error}</p>
        ) : hint ? (
          <p className="ps-meta text-muted">{hint}</p>
        ) : null}
      </div>
    </div>
  )
}

export { FormField }
export type { FormFieldProps }
