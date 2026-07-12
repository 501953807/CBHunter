interface Props {
  title: string
  subtitle: string
  revenue: number | null
  cost: number | null
  profit: number | null
}

export function CockpitFinancialStructure({ title, subtitle, revenue, cost, profit }: Props) {
  const max = Math.max(Math.abs(revenue ?? 0), Math.abs(cost ?? 0), Math.abs(profit ?? 0))
  const rows = [
    { label: '台账收入', value: revenue, tone: 'var(--color-success)' },
    { label: '成本支出', value: cost, tone: 'var(--color-warning)' },
    { label: '净利润', value: profit, tone: profit != null && profit < 0 ? 'var(--color-danger)' : 'var(--color-primary)' },
  ]

  return (
    <div aria-label={title} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{title}</p>
        <span className="text-[11px] text-[var(--color-muted)]">{subtitle}</span>
      </div>
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-2 text-[11px]">
            <span className="text-[var(--color-muted)]">{row.label}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barWidth(row.value, max)}%`, background: row.tone }}
              />
            </div>
            <span className="truncate text-right font-medium text-[var(--color-fg)]">{moneyText(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function barWidth(value: number | null, max: number) {
  if (value == null || max <= 0) return 0
  return Math.max(6, Math.round((Math.abs(value) / max) * 100))
}

function moneyText(value: number | null) {
  if (value == null) return '待补'
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
