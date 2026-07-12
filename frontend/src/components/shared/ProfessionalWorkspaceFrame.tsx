import type { ReactNode } from 'react'

interface WorkspaceMetric {
  label: string
  value: string | number
  hint?: string
}

interface ProfessionalWorkspaceFrameProps {
  eyebrow: string
  title: string
  description: string
  metrics?: WorkspaceMetric[]
  actions?: ReactNode
}

export function ProfessionalWorkspaceFrame({ eyebrow, title, description, metrics = [], actions }: ProfessionalWorkspaceFrameProps) {
  return (
    <section
      aria-label="专业工作台视觉框架"
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--color-fg)]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-start justify-end gap-2">{actions}</div>}
      </div>
      {metrics.length > 0 && (
        <div className="grid border-t border-[var(--color-border)] bg-[var(--color-bg)] md:grid-cols-3">
          {metrics.map(metric => (
            <div key={metric.label} className="border-b border-[var(--color-border)] px-5 py-3 md:border-b-0 md:border-r last:border-r-0">
              <p className="text-[11px] text-[var(--color-muted)]">{metric.label}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{metric.value}</p>
              {metric.hint && <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{metric.hint}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
