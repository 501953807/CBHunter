import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface FilterOption {
  value: string
  label: string
}

interface FilterBarProps {
  filters: {
    key: string
    label: string
    options: FilterOption[]
    value: string
    onChange: (value: string) => void
  }[]
  extra?: ReactNode
}

export function FilterBar({ filters, extra }: FilterBarProps) {
  return (
    <div className="luxury-toolbar flex flex-wrap items-center gap-3 rounded-[var(--radius-xl)] px-3 py-2 text-[var(--color-fg)]">
      {filters.map(f => (
        <FilterDropdown key={f.key} filter={f} />
      ))}
      {extra}
    </div>
  )
}

function FilterDropdown({ filter }: { filter: FilterBarProps['filters'][0] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = filter.options.find(o => o.value === filter.value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        data-active={filter.value ? 'true' : 'false'}
        className="luxury-filter inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        {selected?.label || filter.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="luxury-menu-popover absolute top-full z-50 mt-2 min-w-[160px] rounded-[var(--radius-lg)] p-1.5"
        >
          {filter.options.map(o => (
            <button
              key={o.value}
              onClick={() => { filter.onChange(o.value); setOpen(false) }}
              data-selected={o.value === filter.value ? 'true' : 'false'}
              className="luxury-menu-item block w-full rounded-xl px-3 py-2 text-left text-xs font-medium"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
