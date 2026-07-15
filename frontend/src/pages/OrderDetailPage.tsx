import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/shared/LoadingSkeleton'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import { useOrder, useUpdateOrderStatus, useUpdateOrderNotes } from '../hooks/useOrders'
import { useShipmentList } from '../hooks/useShipments'
import { useTriggerSync } from '../hooks/useSync'
import { useConfig } from '../hooks/useConfig'
import { getAllowedNextStatuses, getStatusMeta } from '../utils/domainOptions'
import type { Shipment } from '../types/shipment'
import type { OrderFinanceEntryContext } from '../types/order'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useOrder(id || '')
  const statusMutation = useUpdateOrderStatus()
  const notesMutation = useUpdateOrderNotes()
  const syncMutation = useTriggerSync()
  const { order_statuses = [] } = useConfig()
  const [notes, setNotes] = useState('')

  const order = data?.data
  const shipmentListQuery = useShipmentList({
    order_id: id || undefined,
    page: 1,
    page_size: 10,
  })
  const relatedShipments = shipmentListQuery.data?.data || []

  // Sync notes from loaded order (prevents overwriting with empty string on save)
  useEffect(() => {
    if (order?.notes != null) setNotes(order.notes)
  }, [order?.notes])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-muted)]">订单未找到</p>
        <Button className="mt-4" onClick={() => navigate('/orders')}>返回订单列表</Button>
      </div>
    )
  }

  const badge = getStatusMeta(order_statuses, order.status)
  const allowedTransitions = getAllowedNextStatuses(order_statuses, order.status)
  const feeDataGaps = order.fee_breakdown?.data_gaps || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="text-[var(--color-muted)] hover:text-[var(--color-muted)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">
              订单 {order.order_number || order.platform_order_id?.slice(0, 12)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <Badge variant={order.source === 'manual' ? 'warning' : 'outline'}>{order.source === 'manual' ? '手工录入' : '平台数据'}</Badge>
              <span className="text-xs text-[var(--color-muted)]">
                {order.platform} · {order.ordered_at ? new Date(order.ordered_at).toLocaleString('zh-CN') : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <EvidenceBanner evidence={data} />
      {order.source === 'manual' && <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">该订单由人工录入，尚未经过平台 API 对账；财务收入需按真实收款另行入账。</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">商品明细</h2></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
                    <th className="pb-2 font-medium">商品</th>
                    <th className="pb-2 font-medium">SKU</th>
                    <th className="pb-2 font-medium text-right">数量</th>
                    <th className="pb-2 font-medium text-right">单价</th>
                    <th className="pb-2 font-medium text-right">小计</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]">
                      <td className="py-2.5 text-[var(--color-fg)]">{item.name}</td>
                      <td className="py-2.5 text-[var(--color-muted)]">{item.sku || '--'}</td>
                      <td className="py-2.5 text-right">{item.quantity}</td>
                      <td className="py-2.5 text-right">{order.currency} {item.unit_price.toFixed(2)}</td>
                      <td className="py-2.5 text-right font-medium">{order.currency} {item.total_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">时间线</h2></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] mt-1.5" />
                    <div className="w-0.5 flex-1 bg-[var(--color-primary-light)]" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--color-fg)]">买家下单</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {order.ordered_at ? new Date(order.ordered_at).toLocaleString('zh-CN') : '--'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] mt-1.5" />
                  <div>
                    <p className="text-sm text-[var(--color-fg)]">当前状态 ({badge.label})</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '--'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      发货时限：{order.fulfillment_deadline_at ? new Date(order.fulfillment_deadline_at).toLocaleString('zh-CN') : '待平台同步'}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      物流渠道：{order.logistics_channel || '待平台同步'} · 售后：{order.after_sales_status || '未知'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <RelatedShipmentsPanel
            shipments={relatedShipments}
            loading={shipmentListQuery.isLoading}
            onCreate={() => navigate(`/shipments/new?order_id=${id}`)}
            onOpen={(shipmentId) => navigate(`/shipments/${shipmentId}`)}
          />

          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">备注</h2></CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] mb-2"
                placeholder="添加备注..."
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => id && notesMutation.mutate({ id, notes })}
                disabled={notesMutation.isPending}
              >
                保存备注
              </Button>
            </CardContent>
          </Card>

          {allowedTransitions.length > 0 && (
            <Card>
              <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">操作</h2></CardHeader>
              <CardContent className="flex gap-2">
                {allowedTransitions.includes('processing') && (
                  <Button onClick={() => id && statusMutation.mutate({ id, status: 'processing' })}>
                    标记处理中
                  </Button>
                )}
                {allowedTransitions.includes('shipped') && (
                  <Button onClick={() => navigate(`/shipments/new?order_id=${id}`)}>
                    <Truck className="w-4 h-4 mr-1.5" />
                    创建物流发货
                  </Button>
                )}
                {allowedTransitions.includes('cancelled') && (
                  <Button variant="danger" onClick={() => id && statusMutation.mutate({ id, status: 'cancelled' })}>
                    取消订单
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">费用汇总</h2></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MoneyRow label="小计" currency={order.currency} value={order.subtotal} />
              <MoneyRow label="运费" currency={order.currency} value={order.shipping_fee} />
              <MoneyRow label="平台费" currency={order.currency} value={order.platform_fee} negative />
              <MoneyRow label="折扣" currency={order.currency} value={order.discount} negative />
              <div className="border-t pt-2 flex justify-between font-semibold text-[var(--color-fg)]">
                <span>总计</span><span>{order.currency} {order.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

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
                      onClick={() => navigate(action.route)}
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
                      onClick={() => navigate(`/finance?entry_type=platform_fee&order_id=${order.id}#finance-ledger`)}
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

          <OrderFinanceEntryPanel
            context={order.finance_entry_context || {}}
            onNavigate={navigate}
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-[var(--color-fg)]">平台同步复盘</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => syncMutation.mutate(order.platform_account_id)}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? '同步中...' : '同步当前店铺订单'}
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

          <Card>
            <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">收货信息</h2></CardHeader>
            <CardContent className="text-sm text-[var(--color-muted)] space-y-1">
              <p><span className="text-[var(--color-muted)]">买家：</span>{order.buyer_name || '--'}</p>
              {order.buyer_notes && <p><span className="text-[var(--color-muted)]">留言：</span>{order.buyer_notes}</p>}
              <div className="pt-2">
                <p className="text-[var(--color-muted)] text-xs mb-1">收货地址：</p>
                {order.shipping_address ? (
                  <pre className="text-xs bg-[var(--color-bg)] p-2 rounded">{JSON.stringify(order.shipping_address, null, 2)}</pre>
                ) : (
                  <p className="text-xs text-[var(--color-muted)]">暂无地址信息</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function RelatedShipmentsPanel({
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

function OrderFinanceEntryPanel({
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

function reconciliationText(status: string) {
  const labels: Record<string, string> = {
    bill_imported: '账单已导入',
    reconciled: '已对账',
    pending: '待对账',
    not_reconciled: '未对账',
  }
  return labels[status] || status
}

function syncStatusLabel(value?: string | null) {
  if (value === 'synced' || value === 'success') return '已同步'
  if (value === 'sync_failed' || value === 'failed' || value === 'partial_failed') return '同步异常'
  if (value === 'manual_not_synced') return '手工未同步'
  if (value === 'not_synced') return '未同步'
  if (value === 'running') return '同步中'
  return '待确认'
}

function syncBadgeVariant(value?: string | null) {
  if (value === 'synced' || value === 'success') return 'success'
  if (value === 'sync_failed' || value === 'failed' || value === 'partial_failed') return 'danger'
  if (value === 'manual_not_synced' || value === 'not_synced') return 'warning'
  return 'outline'
}

function fulfillmentStatusLabel(value?: string | null) {
  if (value === 'shipping_overdue') return '发货超期'
  if (value === 'shipping_due_soon') return '临近时限'
  if (value === 'after_sales_open') return '售后处理中'
  if (value === 'logistics_missing') return '物流待补'
  if (value === 'sync_required') return '同步待补'
  if (value === 'clear') return '正常'
  return '待确认'
}

function fulfillmentBadgeVariant(value?: string | null) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'clear') return 'success'
  return 'outline'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right text-[var(--color-fg)]">{value}</span>
    </div>
  )
}

function MoneyRow({ label, currency, value, negative = false }: { label: string; currency: string; value?: number | null; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={negative && value != null ? 'text-[var(--color-danger)]' : ''}>
        {value == null ? '--' : `${negative ? '-' : ''}${currency} ${value.toFixed(2)}`}
      </span>
    </div>
  )
}
