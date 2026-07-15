import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { usePlatformComparison } from '../../hooks/useAnalytics'
import { labelBusinessCode } from '../../utils/businessLabels'

export function PlatformComparisonChart() {
  const { data, isLoading } = usePlatformComparison()
  const result = data?.data
  const comparison = result?.items ?? []

  const chartData = comparison.map((m) => ({
    name: m.platform.toUpperCase(),
    销售额: m.sales,
    订单数: m.orders,
  }))

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold" style={{ color: 'var(--color-fg)' }}>平台对比</h2>
      </CardHeader>
      <CardContent>
        {result && (
          <div className="mb-3 rounded-md bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
            数据范围：{result.evidence_window} · 数据来源 {result.source_refs.length} 类
            {result.data_gaps.length > 0 && <span className="ml-2 text-[var(--color-warning)]">{result.data_gaps.map(labelBusinessCode).join('；')}</span>}
          </div>
        )}
        {isLoading ? (
          <div className="h-52 rounded animate-pulse" style={{ background: 'var(--color-border)' }} />
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm" style={{ color: 'var(--color-muted)' }}>
            暂无平台数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <Tooltip
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-fg)',
                }}
              />
              <Legend />
              <Bar dataKey="销售额" fill="var(--color-chart-bar)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="订单数" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
