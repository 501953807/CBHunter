import { cn } from '../../utils/cn'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ className, label, error, id, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-[var(--color-fg)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'materio-input luxury-input block w-full rounded-[var(--radius-md)] border px-3.5 py-2.5 text-[15px] shadow-none transition-colors',
          'bg-[var(--color-surface)]',
          'border-[var(--color-border)] text-[var(--color-fg)]',
          'placeholder:text-[var(--color-muted)]',
          'focus:border-[var(--color-primary)] focus:outline-none',
          'disabled:bg-[var(--color-border)]/50 disabled:text-[var(--color-muted)]',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-[13px] text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
