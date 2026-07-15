import type { ReactNode } from 'react'

export type CommandInsightTone = 'primary' | 'success' | 'warning' | 'danger' | 'info'

export interface CommandInsightItem {
  label: string
  value: ReactNode
  insight: string
  tone?: CommandInsightTone
  actionLabel?: string
  onAction?: () => void
}

interface Props {
  ariaLabel: string
  title: string
  subtitle: string
  items: CommandInsightItem[]
}

const toneColor: Record<CommandInsightTone, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
}

export function CommandInsightStrip({ ariaLabel, title, subtitle, items }: Props) {
  return (
    <section
      aria-label={ariaLabel}
      data-ui="command-insight-strip"
      className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">command insights</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-[var(--color-muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-muted)]">
          指标口径 · 业务含义 · 下一步
        </span>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-3">
        {items.map((item) => {
          const color = toneColor[item.tone || 'primary']
          return (
            <article key={item.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-[var(--color-muted)]">{item.label}</p>
                  <div className="mt-1 text-xl font-bold text-[var(--color-fg)]">{item.value}</div>
                </div>
                <span className="mt-1 h-9 w-1.5 rounded-full" style={{ background: color }} />
              </div>
              <p className="mt-3 min-h-10 text-[11px] leading-5 text-[var(--color-muted)]">{item.insight}</p>
              {item.actionLabel && item.onAction ? (
                <button
                  type="button"
                  className="mt-3 inline-flex rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                  onClick={item.onAction}
                >
                  {item.actionLabel}
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
