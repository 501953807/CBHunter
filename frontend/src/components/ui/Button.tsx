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
        'materio-button luxury-control inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium tracking-normal transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
        {
          'text-[var(--color-primary-text)]': variant === 'primary',
          'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]': variant === 'secondary',
          'border border-transparent bg-transparent shadow-none text-[var(--color-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]': variant === 'ghost',
          'border border-transparent bg-[var(--color-danger)] text-[var(--color-primary-text)] hover:brightness-105': variant === 'danger',
          'border border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-transparent text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]': variant === 'outline',
        },
        variant === 'primary' && 'border border-transparent bg-[var(--color-primary)] shadow-[var(--materio-primary-button-shadow)] hover:-translate-y-px hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--materio-primary-button-shadow-hover)]',
        {
          'min-h-8 px-3.5 py-1.5 text-[13px]': size === 'sm',
          'min-h-[38px] px-[18px] py-2 text-[15px]': size === 'md',
          'min-h-11 px-6 py-2.5 text-[16px]': size === 'lg',
        },
        className
      )}
      {...props}
    />
  )
}
