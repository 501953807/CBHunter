import type { ReactNode } from 'react'

interface CommandCenterFrameProps {
  eyebrow: string
  title: string
  description: string
  badge?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

export function CommandCenterFrame({ eyebrow, title, description, badge, actions, children }: CommandCenterFrameProps) {
  return (
    <section
      aria-label="三大中枢控制塔框架"
      data-ui-scheme="hybrid-command-center"
      className="command-center-shell rounded-2xl p-4 text-[var(--color-primary-text)]"
    >
      <div className="command-center-hero command-center-hero-layout">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">{eyebrow}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{title}</h1>
            {badge}
          </div>
          <p className="mt-2 max-w-[38rem] text-xs leading-5 opacity-78">{description}</p>
        </div>
        {actions && (
          <div className="command-center-actions">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="command-center-hero mt-4">{children}</div>}
    </section>
  )
}
