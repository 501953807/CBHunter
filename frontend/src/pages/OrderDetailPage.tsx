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
import {
  InfoRow,
  MoneyRow,
  OrderFinanceEntryPanel,
  RelatedShipmentsPanel,
  fulfillmentBadgeVariant,
  fulfillmentStatusLabel,
  orderV5SkuFieldRows,
  reconciliationText,
  syncBadgeVariant,
  syncStatusLabel,
} from '../features/orders/OrderDetailParts'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useOrder(id || '')
  const statusMutation = useUpdateOrderStatus()
  const notesMutation = useUpdateOrderNotes()
  const syncMutation = useTriggerSync()
  const { order_statuses = [], unified_field_dictionary } = useConfig()
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
      <div className="order-detail-shell page-enter space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="order-detail-shell page-enter text-center py-12">
        <p className="text-[var(--color-muted)]">订单未找到</p>
        <Button className="mt-4" onClick={() => navigate('/orders')}>返回订单列表</Button>
      </div>
    )
  }

  const badge = getStatusMeta(order_statuses, order.status)
  const allowedTransitions = getAllowedNextStatuses(order_statuses, order.status)
  const feeDataGaps = order.fee_breakdown?.data_gaps || []

  return (
    <div className="order-detail-shell page-enter space-y-6">
      <div className="order-detail-hero">
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

      <div className="order-detail-grid">
        <div className="order-detail-main">
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
              {(order.items || []).some(item => item.v5_sku_context) && (
                <div data-ui="order-v5-sku-field-dictionary" className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-fg)]">V5 SKU 字段字典说明</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      订单项只读取店铺 Listing 的 V5 SKU 上下文，不反写订单金额；字段名称来自统一字段字典，平台字段名按当前订单平台展示。
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(order.items || []).map(item => {
                      const rows = orderV5SkuFieldRows(item, unified_field_dictionary, order.platform)
                      if (!rows.length) return null
                      return (
                        <div key={`v5-sku-${item.id}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-[var(--color-fg)]">{item.name}</p>
                            <Badge variant={item.v5_sku_context?.status === 'matched' ? 'success' : 'warning'}>
                              {item.v5_sku_context?.status === 'matched' ? '已匹配店铺 SKU' : 'SKU 上下文待补'}
                            </Badge>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {rows.map(row => (
                              <div key={`${item.id}-${row.key}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-[var(--color-fg)]">{row.label}</p>
                                    <p className="mt-0.5 text-[var(--color-muted)]">{row.platformField}</p>
                                  </div>
                                  <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{row.dataType}</span>
                                </div>
                                <p className="mt-2 break-all text-[var(--color-fg)]">{row.value}</p>
                              </div>
                            ))}
                          </div>
                          {(item.v5_sku_context?.data_gaps || []).length > 0 && (
                            <p className="mt-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-2 text-xs text-[var(--color-warning)]">
                              SKU 数据缺口：{item.v5_sku_context?.data_gaps?.join('、')}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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

        <div className="order-detail-side">
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
