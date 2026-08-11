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
        'luxury-control inline-flex cursor-pointer items-center justify-center rounded-full font-semibold tracking-tight shadow-[var(--shadow-sm)] transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        {
          'text-[var(--color-primary-text)]': variant === 'primary',
          'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]': variant === 'secondary',
          'shadow-none hover:bg-[var(--color-primary-light)] text-[var(--color-muted)] hover:text-[var(--color-primary)]': variant === 'ghost',
          'bg-[var(--color-danger)] text-[var(--color-primary-text)] hover:brightness-105': variant === 'danger',
          'border border-[var(--color-border)] bg-transparent text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]': variant === 'outline',
        },
        variant === 'primary' && 'bg-[var(--color-primary)] hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-md)]',
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
