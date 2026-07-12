import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

export interface BusinessObjectAction {
  label: string
  description: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

export function BusinessObjectActionBar({
  title = '业务对象下钻动作',
  description,
  actions,
}: {
  title?: string
  description?: string
  actions: BusinessObjectAction[]
}) {
  return (
    <section aria-label="业务对象下钻动作" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{title}</p>
        {description && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{description}</p>}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {actions.map(action => <ActionButton key={action.label} action={action} />)}
      </div>
    </section>
  )
}

function ActionButton({ action }: { action: BusinessObjectAction }) {
  const content: ReactNode = (
    <>
      <span className="block text-xs font-medium text-[var(--color-fg)]">{action.label}</span>
      <span className="mt-1 block text-[11px] leading-5 text-[var(--color-muted)]">{action.description}</span>
      <ArrowRight className="absolute right-2 top-2 h-3.5 w-3.5 text-[var(--color-primary)]" />
    </>
  )
  const className = 'relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left transition hover:border-[var(--color-primary)] disabled:opacity-40'
  if (action.href) {
    return <a href={action.disabled ? undefined : action.href} className={`${className} block ${action.disabled ? 'pointer-events-none opacity-40' : ''}`}>{content}</a>
  }
  return <button onClick={action.onClick} disabled={action.disabled} className={className}>{content}</button>
}
