import { formatMoney } from './FinancePageUtils'

export type TracebackRow = {
  id: string
  title: string
  meta: string
  revenue: number | null
  cost: number | null
  profit: number | null
  gaps: string[]
}

export function TracebackColumn({ title, empty, rows }: { title: string; empty: string; rows: TracebackRow[] }) {
  return (
    <div className="finance-traceback-card rounded-[var(--radius-xl)] p-3">
      <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">{title}</p>
      {rows.length === 0 ? (
        <p className="finance-empty-panel rounded-[var(--radius-lg)] p-4 text-center text-xs text-[var(--color-muted)]">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="finance-mini-tile rounded-[var(--radius-lg)] p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--color-fg)]">{row.title}</p>
                  <p className="mt-1 text-[var(--color-muted)]">{row.meta || '来源字段待补'}</p>
                </div>
                <span style={{ color: row.profit == null ? 'var(--color-muted)' : row.profit < 0 ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                  {formatMoney(row.profit)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--color-muted)]">
                <span>收入 {formatMoney(row.revenue)}</span>
                <span>成本 {formatMoney(row.cost)}</span>
                {row.gaps.length > 0 && <span className="text-[var(--color-warning)]">缺口 {row.gaps.join(' / ')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

