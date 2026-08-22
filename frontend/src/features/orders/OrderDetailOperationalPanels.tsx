import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Skeleton } from '../../components/shared/LoadingSkeleton'
import type { OrderDetail, OrderFinanceEntryContext } from '../../types/order'
import type { Shipment } from '../../types/shipment'

export function OrderFeeSummaryPanel({ order }: { order: OrderDetail }) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">费用汇总</h2></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <MoneyRow label="小计" currency={order.currency} value={order.subtotal} />
        <MoneyRow label="运费" currency={order.currency} value={order.shipping_fee} />
        <MoneyRow label="平台费" currency={order.currency} value={order.platform_fee} negative />
        <MoneyRow label="折扣" currency={order.currency} value={order.discount} negative />
        <div className="flex justify-between border-t pt-2 font-semibold text-[var(--color-fg)]">
          <span>总计</span><span>{order.currency} {order.total.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function OrderFulfillmentExceptionPanel({
  order,
  onNavigate,
}: {
  order: OrderDetail
  onNavigate: (route: string) => void
}) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">履约异常复盘</h2></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-muted)]">异常状态</span>
          <Badge variant={fulfillmentBadgeVariant(order.fulfillment_exception?.severity)}>
            {fulfillmentStatusLabel(order.fulfillment_exception?.status)}
          </Badge>
        </div>
        <InfoRow
          label="平台发货时限"
          value={order.fulfillment_exception?.deadline_at ? new Date(order.fulfillment_exception.deadline_at).toLocaleString('zh-CN') : '待平台同步'}
        />
        <InfoRow label="物流渠道" value={order.fulfillment_exception?.logistics_channel || order.logistics_channel || '待补'} />
        <InfoRow label="售后状态" value={order.fulfillment_exception?.after_sales_status || order.after_sales_status || '未知'} />
        {(order.fulfillment_exception?.reasons || []).length > 0 ? (
          <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2 text-xs text-[var(--color-warning)]">
            {(order.fulfillment_exception?.reasons || []).map(reason => <p key={reason}>• {reason}</p>)}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">当前订单未识别到履约异常。</p>
        )}
        {(order.fulfillment_exception?.data_gaps || []).length > 0 && (
          <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs text-[var(--color-muted)]">
            履约缺口：{order.fulfillment_exception?.data_gaps?.join('、')}
          </p>
        )}
        {(order.fulfillment_exception?.actions || []).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-fg)]">异常处理动作闭环</p>
            {(order.fulfillment_exception?.actions || []).map(action => (
              <button
                key={action.code}
                type="button"
                onClick={() => onNavigate(action.route)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left text-xs hover:border-[var(--color-primary)]"
              >
                <span className="font-medium text-[var(--color-primary)]">{action.label}</span>
                {action.description && <span className="mt-1 block text-[var(--color-muted)]">{action.description}</span>}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function OrderPlatformFeeBreakdownPanel({
  order,
  onNavigate,
}: {
  order: OrderDetail
  onNavigate: (route: string) => void
}) {
  const feeDataGaps = order.fee_breakdown?.data_gaps || []
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">平台费用组成</h2></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-muted)]">对账状态</span>
          <Badge variant={order.financial_reconciliation_status === 'bill_imported' || order.financial_reconciliation_status === 'reconciled' ? 'success' : 'warning'}>
            {reconciliationText(order.financial_reconciliation_status)}
          </Badge>
        </div>
        {(order.fee_breakdown?.components || []).map(component => (
          <MoneyRow
            key={component.code}
            label={component.label}
            currency={component.currency || order.currency}
            value={component.amount}
            negative={component.direction === 'deduct'}
          />
        ))}
        {order.fee_breakdown?.wallet && Object.keys(order.fee_breakdown.wallet).length > 0 && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs text-[var(--color-muted)]">
            钱包：{JSON.stringify(order.fee_breakdown.wallet)}
          </div>
        )}
        {feeDataGaps.length > 0 && (
          <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2 text-xs text-[var(--color-warning)]">
            <p>缺口：{feeDataGaps.join('、')}。缺平台账单时不计算完整利润。</p>
            {feeDataGaps.includes('platform_bill') && (
              <button
                type="button"
                onClick={() => onNavigate(`/finance?entry_type=platform_fee&order_id=${order.id}#finance-ledger`)}
                className="mt-2 text-left text-[var(--color-primary)]"
              >
                补录平台账单
              </button>
            )}
          </div>
        )}
        {order.fee_breakdown?.confidence_reason && (
          <p className="text-xs text-[var(--color-muted)]">{order.fee_breakdown.confidence_reason}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function OrderPlatformSyncReviewPanel({
  order,
  syncing,
  onSync,
}: {
  order: OrderDetail
  syncing: boolean
  onSync: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--color-fg)]">平台同步复盘</h2>
          <Button variant="secondary" size="sm" onClick={onSync} disabled={syncing}>
            {syncing ? '同步中...' : '同步当前店铺订单'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-muted)]">订单同步状态</span>
          <Badge variant={syncBadgeVariant(order.platform_sync_review?.status)}>
            {syncStatusLabel(order.platform_sync_review?.status)}
          </Badge>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {order.platform_sync_review?.message || '暂无平台同步复盘信息。'}
        </p>
        <InfoRow
          label="订单快照"
          value={order.platform_sync_review?.order_last_synced_at ? new Date(order.platform_sync_review.order_last_synced_at).toLocaleString('zh-CN') : '待平台同步'}
        />
        {order.platform_sync_review?.latest_store_sync && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs">
            <p className="font-medium text-[var(--color-fg)]">最近店铺订单同步</p>
            <p className="mt-1 text-[var(--color-muted)]">
              状态：{syncStatusLabel(order.platform_sync_review.latest_store_sync.status)} ·
              处理 {order.platform_sync_review.latest_store_sync.records_processed} ·
              新增 {order.platform_sync_review.latest_store_sync.records_created} ·
              更新 {order.platform_sync_review.latest_store_sync.records_updated} ·
              失败 {order.platform_sync_review.latest_store_sync.records_failed}
            </p>
            {order.platform_sync_review.latest_store_sync.error_message && (
              <p className="mt-1 text-[var(--color-danger)]">{order.platform_sync_review.latest_store_sync.error_message}</p>
            )}
          </div>
        )}
        {(order.platform_sync_review?.data_gaps || []).length > 0 && (
          <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2 text-xs text-[var(--color-warning)]">
            同步缺口：{order.platform_sync_review?.data_gaps?.join('、')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function OrderShippingAddressPanel({ order }: { order: OrderDetail }) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">收货信息</h2></CardHeader>
      <CardContent className="space-y-1 text-sm text-[var(--color-muted)]">
        <p><span className="text-[var(--color-muted)]">买家：</span>{order.buyer_name || '--'}</p>
        {order.buyer_notes && <p><span className="text-[var(--color-muted)]">留言：</span>{order.buyer_notes}</p>}
        <div className="pt-2">
          <p className="mb-1 text-xs text-[var(--color-muted)]">收货地址：</p>
          {order.shipping_address ? (
            <pre className="rounded bg-[var(--color-bg)] p-2 text-xs">{JSON.stringify(order.shipping_address, null, 2)}</pre>
          ) : (
            <p className="text-xs text-[var(--color-muted)]">暂无地址信息</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RelatedShipmentsPanel({
  shipments,
  loading,
  onCreate,
  onOpen,
}: {
  shipments: Shipment[]
  loading: boolean
  onCreate: () => void
  onOpen: (shipmentId: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--color-fg)]">关联物流记录</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">直接查看该订单已经创建的本地物流单、运单号、承运商和平台发货时限。</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onCreate}>新增物流</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : shipments.length > 0 ? (
          <div className="space-y-2">
            {shipments.map(shipment => (
              <button
                key={shipment.id}
                type="button"
                onClick={() => onOpen(shipment.id)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-primary)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{shipment.tracking_number || '运单号待补'}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{shipment.carrier || '承运商待补'} · {shipment.shipping_method || '运输方式待补'}</p>
                  </div>
                  <Badge variant={shipment.fulfillment_exception?.severity === 'critical' ? 'danger' : shipment.fulfillment_exception?.severity === 'warning' ? 'warning' : 'outline'}>
                    {shipment.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  平台发货时限：{shipment.fulfillment_deadline_at ? new Date(shipment.fulfillment_deadline_at).toLocaleString('zh-CN') : '待平台同步'}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
            当前订单还没有本地物流记录。需要发货时请创建物流，创建后订单履约异常会自动承接本地物流渠道。
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function OrderFinanceEntryPanel({
  context,
  onNavigate,
}: {
  context: OrderFinanceEntryContext
  onNavigate: (route: string) => void
}) {
  const gaps = context.data_gaps || []
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--color-fg)]">财务入账状态</h2>
          <Badge variant={financeLedgerBadgeVariant(context.status)}>
            {financeLedgerStatusLabel(context.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <FinanceMetric label="关联流水" value={`${context.entry_count || 0} 条`} />
          <FinanceMetric label="销售收入" value={context.revenue_rmb == null ? '待入账' : `¥${context.revenue_rmb.toFixed(2)}`} tone={context.revenue_rmb == null ? 'warning' : 'default'} />
          <FinanceMetric label="费用/成本" value={context.cost_rmb == null ? '待补' : `¥${context.cost_rmb.toFixed(2)}`} tone={gaps.includes('platform_bill') ? 'warning' : 'default'} />
          <FinanceMetric label="订单净利" value={context.net_profit_rmb == null ? '待核算' : `¥${context.net_profit_rmb.toFixed(2)}`} tone={context.net_profit_rmb != null && context.net_profit_rmb < 0 ? 'danger' : 'default'} />
        </div>
        {gaps.length > 0 && (
          <div className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2 text-xs text-[var(--color-warning)]">
            入账缺口：{gaps.join('、')}。订单金额和费用字段不能替代真实财务台账。
          </div>
        )}
        {(context.actions || []).length > 0 && (
          <div className="grid gap-2 md:grid-cols-3">
            {(context.actions || []).map(action => (
              <button
                key={action.code}
                type="button"
                onClick={() => onNavigate(action.route)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left text-xs hover:border-[var(--color-primary)]"
              >
                <span className="font-medium text-[var(--color-primary)]">{action.label}</span>
                {action.reason && <span className="mt-1 block text-[var(--color-muted)]">{action.reason}</span>}
              </button>
            ))}
          </div>
        )}
        {(context.recent_entries || []).length > 0 && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
            <p className="mb-2 text-xs font-medium text-[var(--color-fg)]">最近订单财务流水</p>
            <div className="space-y-1">
              {(context.recent_entries || []).map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--color-muted)]">{entry.description || entry.entry_type}</span>
                  <span className="font-mono text-[var(--color-fg)]">¥{entry.amount_rmb.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {context.confidence_reason && <p className="text-xs text-[var(--color-muted)]">{context.confidence_reason}</p>}
      </CardContent>
    </Card>
  )
}

function FinanceMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}

function financeLedgerStatusLabel(value?: string | null) {
  if (value === 'ledger_ready') return '已入账'
  if (value === 'ledger_missing') return '未入账'
  if (value === 'ledger_incomplete') return '入账待补'
  return '待确认'
}

function financeLedgerBadgeVariant(value?: string | null) {
  if (value === 'ledger_ready') return 'success'
  if (value === 'ledger_missing' || value === 'ledger_incomplete') return 'warning'
  return 'outline'
}

export function reconciliationText(status: string) {
  const labels: Record<string, string> = {
    bill_imported: '账单已导入',
    reconciled: '已对账',
    pending: '待对账',
    not_reconciled: '未对账',
  }
  return labels[status] || status
}

export function syncStatusLabel(value?: string | null) {
  if (value === 'synced' || value === 'success') return '已同步'
  if (value === 'sync_failed' || value === 'failed' || value === 'partial_failed') return '同步异常'
  if (value === 'manual_not_synced') return '手工未同步'
  if (value === 'not_synced') return '未同步'
  if (value === 'running') return '同步中'
  return '待确认'
}

export function syncBadgeVariant(value?: string | null) {
  if (value === 'synced' || value === 'success') return 'success'
  if (value === 'sync_failed' || value === 'failed' || value === 'partial_failed') return 'danger'
  if (value === 'manual_not_synced' || value === 'not_synced') return 'warning'
  return 'outline'
}

export function fulfillmentStatusLabel(value?: string | null) {
  if (value === 'shipping_overdue') return '发货超期'
  if (value === 'shipping_due_soon') return '临近时限'
  if (value === 'after_sales_open') return '售后处理中'
  if (value === 'logistics_missing') return '物流待补'
  if (value === 'sync_required') return '同步待补'
  if (value === 'clear') return '正常'
  return '待确认'
}

export function fulfillmentBadgeVariant(value?: string | null) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'clear') return 'success'
  return 'outline'
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right text-[var(--color-fg)]">{value}</span>
    </div>
  )
}

export function MoneyRow({ label, currency, value, negative = false }: { label: string; currency: string; value?: number | null; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={negative && value != null ? 'text-[var(--color-danger)]' : ''}>
        {value == null ? '--' : `${negative ? '-' : ''}${currency} ${value.toFixed(2)}`}
      </span>
    </div>
  )
}
