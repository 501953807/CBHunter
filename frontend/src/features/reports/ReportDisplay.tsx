import { AlertTriangle, Download, DollarSign, FileText, Percent, ShoppingCart, TrendingUp } from "lucide-react"
import { StatCard } from "../../components/shared/StatCard"
import { Card, CardContent } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import { useFullConfig } from "../../hooks/useConfig"

export function ReportSection({ report, loading }: { report: any; loading: boolean }) {
  const config = useFullConfig()
  const r = report?.data

  if (loading) return <div className="skeleton-shimmer h-96 rounded-xl" />

  if (!r || !r.summary) {
    return (
      <Card>
        <CardContent>
          <EmptyState icon={<FileText className="w-10 h-10" />} title="暂无数据" description="当前时间段无订单记录" />
        </CardContent>
      </Card>
    )
  }

  const s = r.summary
  const hasOrders = s.total_orders > 0
  const exportFeature = config.entitlements.features['exports.enabled']
  const canExport = exportFeature?.enabled === true
  const exportTitle = config.loading ? '正在校验套餐权益' : canExport ? '导出当前报表 CSV' : '当前套餐未启用数据导出，需成长版及以上'
  const missingCostCount = Number(r.data_quality?.missing_cost_items || 0)
  return (
    <>
      <EvidenceBanner evidence={report} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canExport && (
          <span className="text-xs text-[var(--color-muted)]">
            {config.loading ? '套餐权益校验中' : '数据导出需成长版及以上'}
          </span>
        )}
        <button
          onClick={() => { if (canExport) exportReportCsv(r) }}
          disabled={!canExport}
          title={exportTitle}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          <Download className="h-3.5 w-3.5" /> 导出当前报表 CSV
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="总营收" value={hasOrders ? `¥${s.total_revenue.toLocaleString()}` : '--'} icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="订单数" value={hasOrders ? s.total_orders : '--'} icon={<ShoppingCart className="w-4 h-4" />} />
        <StatCard label="总成本" value={s.total_cost == null ? '待补成本' : `¥${s.total_cost.toLocaleString()}`} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="毛利润" value={s.gross_profit == null ? '不可计算' : `¥${s.gross_profit.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} />
        <StatCard label="利润率" value={s.profit_margin_pct == null ? '不可计算' : `${s.profit_margin_pct}%`} icon={<Percent className="w-4 h-4" />} />
      </div>
      {r.data_quality?.cost_status === 'missing' && missingCostCount > 0 && (
        <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">
          {missingCostCount} 条订单商品缺采购成本，毛利润与利润率暂不计算。
        </div>
      )}
      <ReportFinancialRiskPanel signals={r.financial_risk_signals ?? []} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <BarBreakdownChart title="平台营收分布" items={r.by_platform ?? []} nameField="platform" />
        <BarBreakdownChart title="市场营收分布" items={r.by_market ?? []} nameField="platform" />
      </div>
      <CrossDomainMetrics metrics={r.cross_domain} />
      <TopProductsTable products={r.top_products ?? []} />
    </>
  )
}

function CrossDomainMetrics({ metrics }: { metrics?: any }) {
  if (!metrics) return null
  const bars = [
    { label: '财务台账', value: metrics.finance.entry_count, detail: metrics.finance.net_cash_flow == null ? '净现金流待补' : `净现金流 ¥${metrics.finance.net_cash_flow.toLocaleString()}` },
    { label: '履约物流', value: metrics.fulfillment.shipment_count, detail: metrics.fulfillment.delivery_rate_pct == null ? '送达率待补' : `送达率 ${metrics.fulfillment.delivery_rate_pct}%` },
    { label: '库存风险', value: metrics.inventory.open_alerts, detail: `严重 ${metrics.inventory.critical_alerts} 条` },
  ]
  const maxValue = Math.max(...bars.map((item) => item.value || 0), 1)
  return (
    <Card>
      <CardContent>
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">跨域经营指标</h4>
        <div className="space-y-2">
          {bars.map((item) => (
            <div key={item.label} className="rounded-lg bg-[var(--color-bg)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-[var(--color-fg)]">{item.label}</p>
                <p className="text-xs text-[var(--color-muted)]">{item.detail}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(item.value / maxValue * 100, item.value > 0 ? 4 : 0)}%`, background: 'var(--gradient-accent)' }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function BarBreakdownChart({ title, items, nameField }: { title: string; items: any[]; nameField: string }) {
  if (items.length === 0) return (
    <Card>
      <CardContent>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>{title}</h4>
        <p className="rounded-lg bg-[var(--color-bg)] p-3 text-xs text-[var(--color-muted)]">暂无可展示数据</p>
      </CardContent>
    </Card>
  )

  const maxRevenue = Math.max(...items.map(p => p.revenue || 0), 1)
  return (
    <Card>
      <CardContent>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>{title}</h4>
        <div className="space-y-2">
          {items.map((p: any) => {
            const w = Math.max((p.revenue / maxRevenue) * 100, 2)
            return (
              <div key={p[nameField]} className="flex items-center gap-2">
                <span className="text-xs w-16 shrink-0 font-medium" style={{ color: 'var(--color-fg)' }}>
                  {p[nameField]?.toUpperCase?.() || p[nameField] || '未标记'}
                </span>
                <div className="flex-1 h-6 rounded-md relative overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                  <div className="h-full rounded-md flex items-center px-2" style={{ width: `${w}%`, background: 'var(--gradient-accent)' }}>
                    <span className="text-xs text-[var(--color-primary-text)] font-medium">¥{p.revenue.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-xs w-12 text-right" style={{ color: 'var(--color-muted)' }}>{p.orders}单</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ReportFinancialRiskPanel({ signals }: { signals: any[] }) {
  if (!signals.length) return null
  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">报表财务风险</h4>
          </div>
          <span className="rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]">
            {signals.length} 项需复核
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {signals.map((signal) => (
            <div
              key={signal.code}
              className="rounded-xl border p-3 text-sm"
              style={{
                borderColor: signal.level === 'high' ? 'var(--color-danger)' : 'var(--color-warning)',
                background: signal.level === 'high' ? 'var(--color-danger-light)' : 'var(--color-warning-light)',
              }}
            >
              <p className="font-medium text-[var(--color-fg)]">{signal.title}</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{signal.detail}</p>
              <a href={signal.action_route} className="mt-2 inline-block text-xs text-[var(--color-primary)]">
                对策：{signal.action_label}
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function exportReportCsv(report: any) {
  const rows = buildReportRows(report)
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `CBHunter-${report.period || report.date || 'report'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function buildReportRows(report: any) {
  const summary = report.summary || {}
  const rows = [
    ['区块', '名称', '数量', '营收', '备注'],
    ['汇总', '总营收', '', summary.total_revenue ?? '', `订单 ${summary.total_orders ?? 0}`],
    ['汇总', '总成本', '', summary.total_cost ?? '', report.data_quality?.cost_status === 'missing' ? '成本缺失' : '成本完整'],
    ['汇总', '毛利润', '', summary.gross_profit ?? '', summary.profit_margin_pct == null ? '利润率不可计算' : `利润率 ${summary.profit_margin_pct}%`],
  ]
  ;(report.by_platform || []).forEach((item: any) => rows.push(['平台', item.platform || '未标记', item.orders ?? '', item.revenue ?? '', '']))
  ;(report.by_market || []).forEach((item: any) => rows.push(['市场', item.platform || '未标记', item.orders ?? '', item.revenue ?? '', '']))
  ;(report.top_products || []).forEach((item: any) => rows.push(['商品', item.name || '未命名商品', item.quantity ?? '', item.revenue ?? '', '']))
  ;(report.financial_risk_signals || []).forEach((item: any) => rows.push(['财务风险', item.title || item.code || '', '', '', `${item.detail || ''}；对策：${item.action_label || ''}`]))
  return rows
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function TopProductsTable({ products }: { products: any[] }) {
  return (
    <Card>
      <CardContent>
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-fg)' }}>热销商品 Top 10</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>#</th>
                <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>商品名称</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>销量</th>
                <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>营收</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'var(--color-muted)' }}>暂无数据</td></tr>
              ) : (
                products.map((p: any, i: number) => (
                  <tr key={i} className="transition-colors hover:bg-[var(--color-bg)]" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>{i + 1}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-fg)' }}>{p.name}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>{p.quantity}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>¥{p.revenue.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
