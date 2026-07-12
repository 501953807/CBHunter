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
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && <div className="text-[var(--color-muted)] mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-[var(--color-fg)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-muted)] mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
