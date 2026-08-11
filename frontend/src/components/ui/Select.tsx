import { cn } from '../../utils/cn'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  error?: string
}

export function Select({ label, options, value, onChange, placeholder, className, error }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-semibold tracking-tight text-[var(--color-fg)]">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'luxury-select block w-full appearance-none rounded-xl border px-3 py-2 pr-8 text-sm shadow-[var(--shadow-sm)] transition-all',
            'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)]',
            'focus:border-[var(--color-primary)]',
            'disabled:bg-[var(--color-border)]/50 disabled:text-[var(--color-muted)]',
            !value && 'text-[var(--color-muted)]',
            error && 'border-[var(--color-danger)]',
            className
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-[var(--color-muted)]" />
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
