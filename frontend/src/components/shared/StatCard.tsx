import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  change?: number
  loading?: boolean
  onClick?: () => void
  active?: boolean
}

export function StatCard({ label, value, icon, change, loading, onClick, active }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl p-5 animate-pulse" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="h-3 w-20 rounded mb-3" style={{ background: 'var(--color-border)' }} />
        <div className="h-7 w-28 rounded" style={{ background: 'var(--color-border)' }} />
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className="w-full rounded-xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-default"
      style={{ background: 'var(--color-surface)', boxShadow: active ? '0 0 0 2px var(--color-primary), var(--shadow-md)' : 'var(--shadow-sm)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = active ? '0 0 0 2px var(--color-primary), var(--shadow-md)' : 'var(--shadow-sm)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{label}</span>
        {icon && <span className="opacity-60">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{value}</span>
        {change !== undefined && change !== 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-xs font-medium"
            style={{ color: change > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
          >
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </button>
  )
}
