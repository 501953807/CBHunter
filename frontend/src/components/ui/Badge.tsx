import { cn } from '../../utils/cn'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      data-ui="luxury-status-badge"
      data-status-variant={variant}
      className={cn(
        'materio-chip professional-status-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium tracking-normal transition-colors',
        {
          'border-transparent bg-[color-mix(in_srgb,var(--color-muted)_12%,transparent)] text-[var(--color-muted)]': variant === 'default',
          'border-[var(--color-success)] bg-[var(--color-success-light)] text-[var(--color-success)]': variant === 'success',
          'border-[var(--color-warning)] bg-[var(--color-warning-light)] text-[var(--color-warning)]': variant === 'warning',
          'border-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)]': variant === 'danger',
          'border-[var(--color-info)] bg-[var(--color-info-light)] text-[var(--color-info)]': variant === 'info',
          'border border-[var(--color-border)] bg-transparent text-[var(--color-muted)]': variant === 'outline',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
