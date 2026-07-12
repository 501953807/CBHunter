import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { cn } from '../../utils/cn'
import { useSalesTrend } from '../../hooks/useAnalytics'
import { labelBusinessCode } from '../../utils/businessLabels'

const PERIODS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
]

export function SalesTrendChart() {
  const [period, setPeriod] = useState('7d')
  const { data, isLoading } = useSalesTrend(period)
  const result = data?.data
  const trendData = result?.status === 'ready' ? result.data : []

  if (isLoading) {
    return (
      <Card>
        <CardHeader><div className="h-5 w-32 rounded animate-pulse" style={{ background: 'var(--color-border)' }} /></CardHeader>
        <CardContent><div className="h-64 rounded animate-pulse" style={{ background: 'var(--color-border)' }} /></CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>销售趋势</h2>
          <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--color-border)' }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  period === p.value
                    ? 'shadow-sm' : ''
                )}
                style={period === p.value ? {
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)',
                } : {
                  color: 'var(--color-muted)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {result && (
          <div className="mb-3 rounded-md bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
            证据窗口：{result.evidence_window} · 来源 {result.source_refs.length} 类
            {result.data_gaps.length > 0 && <span className="ml-2 text-[var(--color-warning)]">{result.data_gaps.map(labelBusinessCode).join('；')}</span>}
          </div>
        )}
        {trendData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm" style={{ color: 'var(--color-muted)' }}>
            暂无销售数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
                stroke="var(--color-muted)"
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <Tooltip
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)',
                }}
                formatter={(value) => [`¥${Number(value).toFixed(2)}`]}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                name="销售额"
                stroke="var(--color-chart-line)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="订单数"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
