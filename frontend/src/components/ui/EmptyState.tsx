import { cn } from '../../utils/cn'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('luxury-empty-state flex flex-col items-center justify-center rounded-[var(--radius-xl)] px-6 py-12 text-center transition-colors', className)}>
      {icon && <div className="mb-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-primary-light)] p-3 text-[var(--color-primary)]">{icon}</div>}
      <h3 className="mb-1 text-lg font-semibold tracking-tight text-[var(--color-fg)]">{title}</h3>
      {description && <p className="mb-4 max-w-sm text-sm leading-6 text-[var(--color-muted)]">{description}</p>}
      {action}
    </div>
  )
}
