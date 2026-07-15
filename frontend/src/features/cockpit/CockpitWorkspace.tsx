import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Boxes,
  Clock,
  Database,
  Eye,
  ListChecks,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { getOperatingCockpit } from '../../api/cockpit'
import { CommandCenterFrame } from '../../components/shared/CommandCenterFrame'
import { Badge } from '../../components/ui/Badge'
import type { CockpitData, CockpitFilters } from '../../types/cockpit'
import { logger } from '../../utils/logger'
import {
  buildActionQueue,
  CommandPanel,
  DenseRows,
  formatTime,
  mergeSection,
  mergeSourceRefs,
  Mini,
  money,
  StatusPill,
} from './CockpitCommandWidgets'
import { CockpitMetricStrip } from './CockpitMetricStrip'
import { CockpitSidebar } from './CockpitSidebar'
import { CockpitSetupBanner } from './CockpitSetupBanner'
import { CockpitScopeFilters } from './CockpitScopeFilters'
import { CockpitFinancialStructure } from './CockpitFinancialStructure'
import { CockpitStoreCommandBoard } from './CockpitStoreCommandBoard'
import { normalizeCockpitData } from './cockpitCompat'
import { labelBusinessCode } from '../../utils/businessLabels'

export default function CockpitWorkspace() {
  const navigate = useNavigate()
  const [data, setData] = useState<CockpitData | null>(null)
  const [filters, setFilters] = useState<CockpitFilters>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getOperatingCockpit(filters)
      setData(normalizeCockpitData(response.data || null))
    } catch (e: any) {
      logger.error('经营指挥台加载失败', e)
      setError(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  const actionQueue = useMemo(() => (data ? buildActionQueue(data) : []), [data])

  if (loading && !data) return <p className="text-sm text-[var(--color-muted)]">正在聚合真实运营数据...</p>
  if (error && !data) return <p className="text-sm text-[var(--color-danger)]">{error}</p>
  if (!data) return null

  const s = data.sections
  const sourceRefs = mergeSourceRefs([
    s.orders, s.finance, s.inventory, s.product_operations, s.alerts, s.competitors, s.reports, s.ai_suggestions,
    s.store_matrix,
  ])
  const evidenceWindows = [
    s.orders, s.finance, s.inventory, s.product_operations, s.alerts, s.competitors, s.reports, s.ai_suggestions,
    s.store_matrix,
  ].map((section) => section.evidence_window).filter(Boolean)
  const totalSources = [
    s.orders, s.finance, s.inventory, s.product_operations, s.alerts, s.competitors, s.reports, s.ai_suggestions,
    s.store_matrix,
  ]
    .reduce((sum, item) => sum + item.source_count, 0)

  return (
    <div className="space-y-4">
      <CommandCenterFrame
        eyebrow="Command Center"
        title="经营指挥中枢"
        description="以全部平台店铺为总览，以平台、店铺、商品、订单和资金为分解对象，统一查看经营结果、趋势变化和下钻处理入口。"
        badge={<Badge variant={data.data_status === 'ready' ? 'success' : 'warning'}>{data.data_status === 'ready' ? '真实数据已接入' : '等待真实数据'}</Badge>}
        actions={(
          <>
            <StatusPill icon={<ListChecks className="h-3.5 w-3.5" />} label="需处理" value={`${data.attention_count} 项`} />
            <StatusPill icon={<Database className="h-3.5 w-3.5" />} label="来源" value={`${totalSources} 条`} />
            <StatusPill icon={<Clock className="h-3.5 w-3.5" />} label="更新" value={formatTime(data.generated_at)} />
            <button onClick={load} disabled={loading} title="刷新指挥台" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-primary-text)] transition hover:-translate-y-0.5 hover:border-[var(--color-command-accent)] disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      />

      <section aria-label="经营指挥指标">
        <CockpitMetricStrip data={data} onNavigate={navigate} />
      </section>

      <CockpitSetupBanner onNavigate={navigate} />

      <CockpitScopeFilters value={filters} active={data.active_filters} loading={loading} onApply={setFilters} />

      <CockpitStoreCommandBoard data={data} onNavigate={navigate} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CommandPanel title="真实订单" icon={<ShoppingCart className="h-4 w-4" />} section={s.orders} onOpen={() => navigate('/orders')}>
              <div className="flex flex-wrap gap-2">
                {s.orders.metrics.revenue_by_currency.map((item) => (
                  <Badge key={item.currency} variant="outline">{item.currency} {item.revenue.toLocaleString()} · {item.orders} 单</Badge>
                ))}
              </div>
              <DenseRows empty="暂无真实订单" rows={s.orders.items.slice(0, 5).map((item) => ({
                key: item.id,
                title: item.order_number,
                detail: `${item.platform || '平台未知'} · ${item.status} · ${formatTime(item.ordered_at)}`,
                value: `${item.currency} ${item.total.toLocaleString()}`,
              }))} />
            </CommandPanel>

            <CommandPanel title="利润与资金" icon={<WalletCards className="h-4 w-4" />} section={s.finance} onOpen={() => navigate('/finance')}>
              <div className="grid grid-cols-3 gap-2">
                <Mini label="台账收入" value={money(s.finance.metrics.total_revenue_rmb)} />
                <Mini label="成本" value={money(s.finance.metrics.total_cost_rmb)} />
                <Mini label="净利润" value={money(s.finance.metrics.net_profit_rmb)} tone={s.finance.metrics.net_profit_rmb != null && s.finance.metrics.net_profit_rmb < 0 ? 'danger' : 'normal'} />
              </div>
              <CockpitFinancialStructure
                title="资金结构"
                subtitle="利润构成"
                revenue={s.finance.metrics.total_revenue_rmb}
                cost={s.finance.metrics.total_cost_rmb}
                profit={s.finance.metrics.net_profit_rmb}
              />
              <DenseRows empty="暂无财务台账" rows={s.finance.items.slice(0, 4).map((item) => ({
                key: item.id,
                title: labelBusinessCode(item.entry_type),
                detail: item.description || '财务台账',
                value: `¥${item.amount_rmb.toLocaleString()}`,
              }))} />
            </CommandPanel>

            <CommandPanel title="库存与履约" icon={<Boxes className="h-4 w-4" />} section={mergeSection(s.inventory, s.alerts)} onOpen={() => navigate('/inventory-alerts')}>
              <div className="grid grid-cols-4 gap-2">
                <Mini label="Listing" value={String(s.inventory.metrics.active_listings)} />
                <Mini label="确认库存" value={String(s.inventory.metrics.confirmed_stock)} />
                <Mini label="库存未知" value={String(s.inventory.metrics.unknown_stock_listings)} tone={s.inventory.metrics.unknown_stock_listings ? 'warning' : 'normal'} />
                <Mini label="预警" value={String(s.alerts.metrics.open)} tone={s.alerts.metrics.open ? 'danger' : 'normal'} />
              </div>
              <DenseRows empty="暂无库存预警" rows={s.alerts.items.slice(0, 5).map((item) => ({
                key: item.id,
                title: item.product_name,
                detail: `${item.severity} · 阈值 ${item.threshold} · ${formatTime(item.created_at)}`,
                value: `${item.current_stock} 件`,
                danger: true,
              }))} />
            </CommandPanel>

            <CommandPanel title="商品运营表现" icon={<Sparkles className="h-4 w-4" />} section={s.product_operations} onOpen={() => navigate('/growth')}>
              <div className="grid grid-cols-4 gap-2">
                <Mini label="Listing" value={String(s.product_operations.metrics.listing_count)} />
                <Mini label="诊断" value={String(s.product_operations.metrics.diagnosed_listing_count)} tone={s.product_operations.metrics.diagnosed_listing_count ? 'warning' : 'normal'} />
                <Mini label="待复盘" value={String(s.product_operations.metrics.pending_action_count)} tone={s.product_operations.metrics.pending_action_count ? 'warning' : 'normal'} />
                <Mini label="已复盘" value={String(s.product_operations.metrics.reviewed_action_count)} />
              </div>
              <DenseRows empty="暂无商品运营诊断" rows={s.product_operations.items.slice(0, 5).map((item) => ({
                key: item.listing_id,
                title: item.title,
                detail: `${item.diagnostic_title} · 浏览 ${item.views_30d ?? '--'} · 订单 ${item.orders_30d ?? '--'} · ${item.review_result || item.effect_summary || '待填写复盘'}`,
                value: item.conversion_rate_pct == null ? '转化待补' : `${item.conversion_rate_pct}%`,
                danger: item.pending_count > 0,
              }))} />
            </CommandPanel>

            <CommandPanel title="竞品与市场" icon={<Eye className="h-4 w-4" />} section={s.competitors} onOpen={() => navigate('/monitor')}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">跟踪 {s.competitors.metrics.tracked}</Badge>
                <Badge variant={s.competitors.metrics.price_changes_detected ? 'warning' : 'success'}>
                  价格变化 {s.competitors.metrics.price_changes_detected}
                </Badge>
              </div>
              <DenseRows empty="暂无竞品跟踪" rows={s.competitors.items.slice(0, 5).map((item) => ({
                key: item.id,
                title: item.name,
                detail: `${item.platform} · 上次更新 ${formatTime(item.last_updated)}`,
                value: item.price == null ? '价格未知' : String(item.price),
              }))} />
            </CommandPanel>
          </div>
        </div>

        <CockpitSidebar actionQueue={actionQueue} sourceRefs={sourceRefs} evidenceWindows={evidenceWindows} loading={loading} onNavigate={navigate} onRefresh={load} />
      </div>
    </div>
  )
}
