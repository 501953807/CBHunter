import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, ArrowRight, Package, AlertTriangle, ShoppingCart, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { SalesTrendChart } from '../../components/charts/SalesTrendChart'
import { PlatformComparisonChart } from '../../components/charts/PlatformComparisonChart'
import { useOrderList } from '../../hooks/useOrders'
import { useSuggestions, useMarkApplied, useDismissSuggestion, useRunAnalysis } from '../../hooks/useAI'
import { useDashboardKPIs } from '../../hooks/useAnalytics'
import { useConfig } from '../../hooks/useConfig'
import { getBlueOceanOpportunities, getDashboardSummary, type BlueOceanOpportunity } from '../../api/dashboard'
import { getProductClassification, type ProductClassData } from '../../api/products'
import type { DashboardSummary } from '../../types/sourcing'
import { logger } from '../../utils/logger'
import { DashboardOperationalOverview } from './DashboardOperationalOverview'
import { ProductHealthPanel } from './ProductHealthPanel'
import { labelBusinessCode } from '../../utils/businessLabels'
import { getStatusMeta } from '../../utils/domainOptions'

const SEVERITY_CONFIG: Record<string, { label: string; variant: 'danger' | 'warning' | 'info' }> = {
  critical: { label: '紧急', variant: 'danger' },
  warning: { label: '警告', variant: 'warning' },
  info: { label: '建议', variant: 'info' },
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  sales: <BarChart3 className="w-5 h-5" />,
  orders: <ShoppingCart className="w-5 h-5" />,
  products: <Package className="w-5 h-5" />,
  ai: <Brain className="w-5 h-5" />,
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: ordersData } = useOrderList({ page_size: 5 })
  const { data: suggestionsData } = useSuggestions()
  const { data: kpiData } = useDashboardKPIs()
  const { markets, order_statuses = [] } = useConfig()
  const markApplied = useMarkApplied()
  const dismissMutation = useDismissSuggestion()
  const runAnalysis = useRunAnalysis()
  const [classData, setClassData] = useState<ProductClassData | null>(null)
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null)
  const [blueOcean, setBlueOcean] = useState<{ opportunities?: BlueOceanOpportunity[] }>({})
  const [blueOceanLoading, setBlueOceanLoading] = useState(false)

  useEffect(() => {
    getProductClassification().then(res => {
      if (res.data) setClassData(res.data)
    }).catch(e => logger.error('Load product classification failed', e))
    getDashboardSummary().then(r => setDashSummary(r.data)).catch(e => logger.error('Load dashboard summary failed', e))
    loadBlueOcean()
  }, [])

  const loadBlueOcean = async (market?: string) => {
    setBlueOceanLoading(true)
    try {
      const res = await getBlueOceanOpportunities({ market, limit: 5 })
      setBlueOcean(res.data || {})
    } catch (e: any) { logger.error('Operation failed', e) }
    setBlueOceanLoading(false)
  }

  const orders = ordersData?.data ?? []
  const suggestions = suggestionsData?.data ?? []
  const kpis = kpiData?.data
  const criticalCount = suggestions.filter((s) => s.severity === 'critical' && !s.is_dismissed).length

  const renderSuggestionBadge = (severity: string) => {
    const sev = SEVERITY_CONFIG[severity] || { label: severity, variant: 'info' as const }
    return <Badge variant={sev.variant}><span className="text-[11px]">{sev.label}</span></Badge>
  }

  const kpiCards = [
    {
      key: 'sales',
      label: '最近30天销售',
      value: kpis?.status === 'ready' ? `¥${kpis.total_sales.toFixed(2)}` : '--',
      sub: kpis?.sales_change_pct != null ? (
        <span className={kpis.sales_change_pct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
          {kpis.sales_change_pct >= 0 ? '↑' : '↓'} {Math.abs(kpis.sales_change_pct).toFixed(1)}% 较上一个同天数范围
        </span>
      ) : <span className="text-[var(--color-muted)]">上一个同天数范围无可比数据</span>,
      icon: 'sales',
    },
    {
      key: 'orders',
      label: '订单数',
      value: kpis?.status === 'ready' ? String(kpis.order_count) : '--',
      sub: kpis?.status === 'ready' ? `客单价 ¥${kpis.avg_order_value.toFixed(2)}` : '缺少有效订单',
      icon: 'orders',
    },
    {
      key: 'products',
      label: '活跃商品',
      value: String(kpis?.active_products || 0),
      sub: `${kpis?.active_listings || 0} 个 Listing`,
      icon: 'products',
    },
    {
      key: 'ai',
      label: 'AI 建议',
      value: String(suggestions.length),
      sub: criticalCount > 0
        ? <span className="text-[var(--color-danger)] font-medium">{criticalCount} 条紧急</span>
        : <span className="text-[var(--color-muted)]">暂无紧急事项</span>,
      icon: 'ai',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-danger-light)] border border-[var(--color-danger)]/30 rounded-lg text-sm text-[var(--color-danger)]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{criticalCount} 条紧急建议</span>
          <button onClick={() => navigate('/ai-suggestions')} className="ml-auto underline text-xs font-medium opacity-80 hover:opacity-100">
            查看详情
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.key}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>{kpi.label}</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>{kpi.value}</p>
                  {kpi.sub && <p className="text-xs mt-1">{kpi.sub}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                  {KPI_ICONS[kpi.key]}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DashboardOperationalOverview
        summary={dashSummary}
        opportunities={blueOcean.opportunities || []}
        markets={markets}
        loading={blueOceanLoading}
        onLoadOpportunities={loadBlueOcean}
      />

      {kpis && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
          <span>经营指标数据范围：{kpis.evidence_window} · 数据来源 {kpis.source_refs.length} 类</span>
          {kpis.data_gaps.length > 0 && <span className="ml-2 text-[var(--color-warning)]">{kpis.data_gaps.map(labelBusinessCode).join('；')}</span>}
        </div>
      )}

      {classData && <ProductHealthPanel data={classData} />}

      {/* Charts + AI Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SalesTrendChart />
          <PlatformComparisonChart />
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5">
                <Brain className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                AI 运营建议
              </h2>
              <button
                onClick={() => runAnalysis.mutate()}
                className="text-xs font-medium disabled:opacity-50"
                style={{ color: 'var(--color-primary)' }}
                disabled={runAnalysis.isPending}
              >
                {runAnalysis.isPending ? '分析中...' : '刷新'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-border)' }} />
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>暂无建议</p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-border)' }}>点击刷新生成运营建议</p>
              </div>
            ) : (
              suggestions.slice(0, 8).map((s) => (
                <div key={s.id} className="p-3 rounded-lg text-sm border"
                  style={{
                    background: 'color-mix(in oklch, var(--color-primary) 4%, var(--color-surface))',
                    borderColor: 'var(--color-border)',
                  }}>
                  <div className="flex items-start gap-2">
                    {renderSuggestionBadge(s.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--color-fg)' }}>{s.title}</p>
                      {!s.is_read && (
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => markApplied.mutate(s.id)} className="text-xs font-medium"
                            style={{ color: 'var(--color-primary)' }}>应用</button>
                          <button onClick={() => dismissMutation.mutate(s.id)} className="text-xs"
                            style={{ color: 'var(--color-muted)' }}>忽略</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {suggestions.length > 8 && (
              <button onClick={() => navigate('/ai-suggestions')} className="w-full text-center text-xs font-medium py-2"
                style={{ color: 'var(--color-primary)' }}>
                查看全部 {suggestions.length} 条建议 <ArrowRight className="w-3 h-3 inline" />
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            最近订单
          </h2>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-muted)' }}>暂无订单数据</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ color: 'var(--color-muted)', borderColor: 'var(--color-border)' }}>
                  <th className="pb-2.5 font-medium text-xs uppercase tracking-wider">订单号</th>
                  <th className="pb-2.5 font-medium text-xs uppercase tracking-wider">平台</th>
                  <th className="pb-2.5 font-medium text-xs uppercase tracking-wider">状态</th>
                  <th className="pb-2.5 font-medium text-xs uppercase tracking-wider text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
                    onClick={() => navigate(`/orders/${o.id}`)}>
                    <td className="py-2.5 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>{o.order_number || o.id.slice(0, 8)}</td>
                    <td className="py-2.5"><Badge variant="default">{o.platform || '--'}</Badge></td>
                    <td className="py-2.5">
                      <Badge variant={getStatusMeta(order_statuses, o.status, 'info').variant}>{getStatusMeta(order_statuses, o.status, 'info').label}</Badge>
                    </td>
                    <td className="py-2.5 text-right font-medium" style={{ color: 'var(--color-fg)' }}>¥{o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
