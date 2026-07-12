import { cn } from '../../utils/cn'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-fg)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
          'bg-[var(--color-surface)]',
          'border-[var(--color-border)] text-[var(--color-fg)]',
          'placeholder:text-[var(--color-muted)]',
          'focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
          'disabled:bg-[var(--color-border)]/50 disabled:text-[var(--color-muted)]',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
