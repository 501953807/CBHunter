import type { DictCategory } from '../../hooks/useConfig'

interface CategoryPillsProps {
  categories: DictCategory[]
  selected: string
  onChange: (id: string) => void
  totals?: Record<string, number>
}

export function CategoryPills({ categories, selected, onChange, totals }: CategoryPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: selected === cat.id ? 'var(--color-primary)' : 'var(--color-border)',
            color: selected === cat.id ? 'var(--color-primary-text)' : 'var(--color-muted)',
          }}
        >
          <span>{cat.icon || '📦'}</span>
          <span>{cat.label}</span>
          {totals && totals[cat.id] !== undefined && (
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[11px] font-bold px-1"
              style={{
                background: selected === cat.id ? 'var(--color-active-overlay)' : 'var(--color-bg)',
              }}
            >
              {totals[cat.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
