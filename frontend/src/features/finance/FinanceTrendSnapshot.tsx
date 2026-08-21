import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { formatMoney } from './FinancePageUtils'

type FinanceTrendPoint = {
  label: string
  value: number
  tone: string
}

export function FinanceTrendSnapshot({
  periodLabel,
  points,
  hasData,
}: {
  periodLabel: string
  points: FinanceTrendPoint[]
  hasData: boolean
}) {
  const maxAbs = Math.max(...points.map(point => Math.abs(point.value)), 1)
  const chartWidth = 360
  const chartHeight = 148
  const step = chartWidth / Math.max(points.length - 1, 1)
  const polyline = points
    .map((point, index) => {
      const x = index * step
      const y = chartHeight - 20 - (Math.abs(point.value) / maxAbs) * (chartHeight - 44)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <Card className="finance-panel">
      <CardHeader>
        <h2 className="font-semibold text-[var(--color-fg)]">财务趋势快照</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          以{periodLabel}真实台账汇总展示收入趋势、成本趋势、利润趋势和资金趋势；未入账时保持空态，不补造趋势。
        </p>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div data-ui="finance-trend-chart" className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="finance-chart-panel rounded-[var(--radius-xl)] p-3">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="财务趋势快照图" className="h-44 w-full overflow-visible">
                {[0, 1, 2, 3].map((line) => (
                  <line key={line} x1="0" x2={chartWidth} y1={20 + line * 34} y2={20 + line * 34} stroke="var(--color-border)" strokeDasharray="4 6" />
                ))}
                <polyline points={polyline} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((point, index) => {
                  const x = index * step
                  const y = chartHeight - 20 - (Math.abs(point.value) / maxAbs) * (chartHeight - 44)
                  return (
                    <g key={point.label}>
                      <circle cx={x} cy={y} r="5" fill={point.tone} />
                      <text x={x} y={chartHeight - 2} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} fill="var(--color-muted)" fontSize="11">
                        {point.label.replace('趋势', '')}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="space-y-2">
              {points.map(point => (
                <div key={point.label} className="finance-structure-card rounded-[var(--radius-xl)] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-fg)]">{point.label}</span>
                    <span style={{ color: point.tone }}>{formatMoney(point.value)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--color-border)]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(Math.abs(point.value) / maxAbs * 100, point.value ? 4 : 0)}%`, background: point.tone }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="finance-empty-panel rounded-[var(--radius-xl)] p-5 text-center text-sm text-[var(--color-muted)]">
            暂无真实财务台账，收入趋势、成本趋势、利润趋势和资金趋势不展示模拟数据。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

