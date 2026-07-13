import { cn } from '../../utils/cn'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      data-status-variant={variant}
      className={cn(
        'professional-status-chip inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors',
        {
          'bg-[var(--color-border)] text-[var(--color-muted)]': variant === 'default',
          'bg-[var(--color-success-light)] text-[var(--color-success)]': variant === 'success',
          'bg-[var(--color-warning-light)] text-[var(--color-warning)]': variant === 'warning',
          'bg-[var(--color-danger-light)] text-[var(--color-danger)]': variant === 'danger',
          'bg-[var(--color-info-light)] text-[var(--color-info)]': variant === 'info',
          'border border-[var(--color-border)] text-[var(--color-muted)]': variant === 'outline',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
