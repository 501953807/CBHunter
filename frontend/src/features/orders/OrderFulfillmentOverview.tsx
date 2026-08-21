import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import type { OrderFulfillmentStats } from '../../types/order'

export function OrderFulfillmentOverview({
  stats,
  platformLabelMap,
  onOpenExceptions,
}: {
  stats: OrderFulfillmentStats | null
  platformLabelMap: Map<string, string>
  onOpenExceptions: () => void
}) {
  const fulfillment = stats?.fulfillment
  const totalRisk = (fulfillment?.overdue || 0) + (fulfillment?.due_soon || 0) + (fulfillment?.logistics_missing || 0) + (fulfillment?.after_sales_open || 0)
  return (
    <section aria-label="订单履约运营总览" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="orders-command-panel">
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">Fulfillment Command</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">履约运营总览</h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">按真实订单状态、平台发货时限、物流渠道和售后状态聚合；缺失字段进入数据缺口。</p>
            </div>
            <Button size="sm" variant={totalRisk ? 'primary' : 'secondary'} onClick={onOpenExceptions}>
              查看异常订单
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <FulfillmentMetric label="待发货" value={fulfillment?.pending_shipment || 0} detail="未进入已发货/完成状态" tone="warning" />
            <FulfillmentMetric label="已发货/完成" value={fulfillment?.shipped || 0} detail="已发货、运输中、已送达或完成" tone="success" />
            <FulfillmentMetric label="临近超期" value={fulfillment?.due_soon || 0} detail="距平台发货时限不足 12 小时" tone="warning" />
            <FulfillmentMetric label="已超期" value={fulfillment?.overdue || 0} detail="超过平台发货 SLA" tone="danger" />
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <FulfillmentMetric label="物流待补" value={fulfillment?.logistics_missing || 0} detail="缺物流渠道或发货记录" tone="warning" compact />
            <FulfillmentMetric label="售后处理中" value={fulfillment?.after_sales_open || 0} detail="退款/退货/争议待跟进" tone="warning" compact />
            <FulfillmentMetric label="同步待补" value={fulfillment?.sync_required || 0} detail="缺平台订单同步时间" tone="info" compact />
            <FulfillmentMetric label="时限缺口" value={fulfillment?.missing_deadline || 0} detail="缺平台发货时限" tone="info" compact />
          </div>
          {(stats?.data_gaps || []).length > 0 && (
            <div className="orders-gap-panel rounded-[var(--radius-xl)] px-3 py-2 text-xs text-[var(--color-muted)]">
              数据缺口：{stats?.data_gaps.join('、')}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="orders-command-panel">
        <CardContent className="space-y-3 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">平台/店铺履约分布</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">用于判断哪个平台、哪个店铺正在积压待发货或超期订单。</p>
          </div>
          <div className="space-y-2">
            {(stats?.store_breakdown || []).slice(0, 4).map(store => (
              <div key={store.platform_account_id} className="orders-store-card rounded-[var(--radius-xl)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{store.platform_account_name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{platformLabelMap.get(store.platform) || store.platform.toUpperCase()} · {store.total_orders} 单</p>
                  </div>
                  <Badge variant={store.overdue ? 'danger' : store.due_soon ? 'warning' : 'success'}>
                    {store.overdue ? `${store.overdue} 超期` : store.due_soon ? `${store.due_soon} 临近` : '正常'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">待发 {store.pending_shipment}</span>
                  <span className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">已发 {store.shipped}</span>
                  <span className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">风险 {store.due_soon + store.overdue}</span>
                </div>
              </div>
            ))}
            {!stats?.store_breakdown?.length && (
              <div className="orders-gap-panel rounded-[var(--radius-xl)] border-dashed p-4 text-sm text-[var(--color-muted)]">
                暂无订单履约统计；同步平台订单或创建手工订单后展示店铺分布。
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function FulfillmentMetric({
  label,
  value,
  detail,
  tone,
  compact,
}: {
  label: string
  value: number
  detail: string
  tone: 'success' | 'warning' | 'danger' | 'info'
  compact?: boolean
}) {
  const color = tone === 'danger'
    ? 'var(--color-danger)'
    : tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'success'
        ? 'var(--color-success)'
        : 'var(--color-info)'
  return (
    <div className="orders-metric-card rounded-[var(--radius-xl)] p-3" data-tone={tone}>
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={compact ? 'mt-1 text-xl font-semibold' : 'mt-2 text-3xl font-bold'} style={{ color }}>{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}
