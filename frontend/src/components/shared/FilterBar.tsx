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
    <div className="flex flex-wrap items-center gap-3" style={{ color: 'var(--color-fg)' }}>
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        style={{
          background: filter.value ? 'var(--color-primary)' : 'var(--color-border)',
          color: filter.value ? 'var(--color-primary-text)' : 'var(--color-muted)',
        }}
      >
        {selected?.label || filter.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 rounded-xl py-1.5 min-w-[140px] z-50"
          style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)' }}
        >
          {filter.options.map(o => (
            <button
              key={o.value}
              onClick={() => { filter.onChange(o.value); setOpen(false) }}
              className="block w-full text-left px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
              style={{
                color: o.value === filter.value ? 'var(--color-primary)' : 'var(--color-fg)',
                background: o.value === filter.value ? 'var(--color-primary-light)' : 'transparent',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
