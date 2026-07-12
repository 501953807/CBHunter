import { cn } from '../../utils/cn'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
        {
          'text-[var(--color-primary-text)] focus:ring-[var(--color-primary)]': variant === 'primary',
          'bg-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-muted)]/20 focus:ring-[var(--color-muted)]': variant === 'secondary',
          'hover:bg-[var(--color-border)] text-[var(--color-muted)]': variant === 'ghost',
          'bg-[var(--color-danger)] text-[var(--color-primary-text)] hover:opacity-90 focus:ring-[var(--color-danger)]': variant === 'danger',
          'border border-[var(--color-border)] text-[var(--color-fg)] hover:bg-[var(--color-border)]': variant === 'outline',
        },
        variant === 'primary' && 'bg-[var(--color-primary)] hover:brightness-110 shadow-sm hover:shadow-md',
        {
          'px-2.5 py-1.5 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    />
  )
}
