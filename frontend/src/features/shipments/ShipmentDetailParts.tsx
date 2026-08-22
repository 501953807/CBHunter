import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/shared/LoadingSkeleton'
import { getStatusMeta, withAllOption } from '../../utils/domainOptions'
import type { OrderDetail } from '../../types/order'
import type { Shipment } from '../../types/shipment'

export type ShipmentDetailFormState = {
  order_id: string
  carrier: string
  shipping_method: string
  tracking_number: string
  status: string
  shipping_cost: string
  actual_weight_g: string
  volumetric_weight_g: string
  destination_market: string
  destination_city: string
  destination_address: string
  estimated_delivery_date: string
}

type SelectOption = { value: string; label: string }
type ShipmentStatusOption = { id: string; label: string; variant?: string }

export function ShipmentFormPanel({
  carrierOptions,
  form,
  isNew,
  marketOptions,
  setForm,
  shipmentStatusOptions,
  shippingMethodOptions,
}: {
  carrierOptions: SelectOption[]
  form: ShipmentDetailFormState
  isNew: boolean
  marketOptions: SelectOption[]
  setForm: (form: ShipmentDetailFormState) => void
  shipmentStatusOptions: SelectOption[]
  shippingMethodOptions: SelectOption[]
}) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">物流信息</h2></CardHeader>
      <CardContent>
        <div className="max-w-lg space-y-4">
          <Input label="关联订单 ID" id="order_id" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} placeholder="输入订单ID" disabled={!isNew} />
          <Select label="承运商 *" options={withAllOption('选择承运商', carrierOptions)} value={form.carrier} onChange={(v) => setForm({ ...form, carrier: v })} />
          <Select label="目的市场" options={withAllOption('选择东南亚目的市场', marketOptions)} value={form.destination_market} onChange={(v) => setForm({ ...form, destination_market: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="目的城市" value={form.destination_city} onChange={e => setForm({ ...form, destination_city: e.target.value })} />
            <Input label="预计送达" type="date" value={form.estimated_delivery_date} onChange={e => setForm({ ...form, estimated_delivery_date: e.target.value })} />
          </div>
          <Input label="目的地址" value={form.destination_address} onChange={e => setForm({ ...form, destination_address: e.target.value })} />
          <Select label="运输方式" options={withAllOption('选择运输方式', shippingMethodOptions)} value={form.shipping_method} onChange={(v) => setForm({ ...form, shipping_method: v })} />
          <Select label="物流状态" options={shipmentStatusOptions} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          <Input label="运单号" id="tracking" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} placeholder="输入追踪单号" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="运费 (¥)" id="cost" type="number" value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })} />
            <Input label="实际重量 (g)" id="weight" type="number" value={form.actual_weight_g} onChange={(e) => setForm({ ...form, actual_weight_g: e.target.value })} />
          </div>
          <Input label="体积重量 (g)" type="number" value={form.volumetric_weight_g} onChange={e => setForm({ ...form, volumetric_weight_g: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ShipmentStatusLifecycle({
  shipment,
  statusOptions,
}: {
  shipment: Shipment
  statusOptions: ShipmentStatusOption[]
}) {
  const options = statusOptions.length > 0 ? statusOptions : [{ id: shipment.status, label: shipment.status }]
  const statusIds = new Set(options.map(item => item.id))
  const timeline = statusIds.has(shipment.status)
    ? options
    : [...options, { id: shipment.status, label: `未配置状态：${shipment.status}` }]
  const activeIndex = timeline.findIndex(item => item.id === shipment.status)
  const activeLabel = getStatusMeta(statusOptions, shipment.status).label
  const deadlineLabel = shipment.fulfillment_deadline_at
    ? new Date(shipment.fulfillment_deadline_at).toLocaleString('zh-CN')
    : '平台发货时限待同步'

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--color-fg)]">物流状态轨迹</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">基于系统物流状态字典展示当前履约阶段；承运商真实轨迹在下方“物流追踪”单独展示。</p>
          </div>
          <Badge variant={getStatusMeta(statusOptions, shipment.status).variant}>{activeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <ContextMetric label="当前状态" value={activeLabel} tone={shipment.status === 'exception' ? 'danger' : 'default'} />
          <ContextMetric label="运单号" value={shipment.tracking_number || '运单号待补'} tone={shipment.tracking_number ? 'default' : 'warning'} />
          <ContextMetric
            label="平台发货时限"
            value={deadlineLabel}
            tone={shipment.fulfillment_exception?.severity === 'critical' ? 'danger' : shipment.fulfillment_exception?.severity === 'warning' ? 'warning' : 'default'}
          />
        </div>
        <div className="overflow-x-auto" aria-label="物流状态字典轨迹">
          <div className="flex min-w-max items-start gap-2 pb-1">
            {timeline.map((item, index) => {
              const isActive = index === activeIndex
              const isDone = activeIndex >= 0 && index < activeIndex
              const nodeColor = isActive ? 'var(--color-primary)' : isDone ? 'var(--color-success)' : 'var(--color-border)'
              return (
                <div key={item.id} className="flex min-w-[120px] flex-1 items-start">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold"
                      style={{
                        borderColor: nodeColor,
                        background: isActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
                        color: isActive || isDone ? nodeColor : 'var(--color-muted)',
                      }}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 max-w-[110px] text-center text-xs font-medium text-[var(--color-fg)]">{item.label}</span>
                    <span className="mt-1 text-[11px] text-[var(--color-muted)]">{isActive ? '当前阶段' : isDone ? '已推进' : '待推进'}</span>
                  </div>
                  {index < timeline.length - 1 && <div className="mt-4 h-px min-w-[48px] flex-1" style={{ background: isDone ? 'var(--color-success)' : 'var(--color-border)' }} />}
                </div>
              )
            })}
          </div>
        </div>
        {activeIndex < 0 && (
          <p className="rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
            当前物流状态未在统一字典中配置，请到设置中心业务字典补齐后再继续使用。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function ShipmentTrackingTimeline({ shipment }: { shipment: Shipment }) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">物流追踪</h2></CardHeader>
      <CardContent>
        {shipment.tracking_events && shipment.tracking_events.length > 0 ? (
          <div className="space-y-4">
            {shipment.tracking_events.map((event, index) => (
              <div key={`${event.timestamp}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${index === 0 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
                  {index < (shipment.tracking_events?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-[var(--color-border)]" />}
                </div>
                <div>
                  <p className="text-sm text-[var(--color-fg)]">{event.description || event.status}</p>
                  <p className="text-xs text-[var(--color-muted)]">{event.location ? `${event.location} · ` : ''}{event.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-[var(--color-muted)]">
            <p className="text-sm">暂无追踪信息</p>
            <p className="text-xs mt-1">当前未接入真实承运商轨迹，或承运商尚未返回轨迹</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ShipmentRelatedOrderPanel({
  shipment,
  onOpenOrder,
}: {
  shipment: Shipment
  onOpenOrder: () => void
}) {
  return (
    <div className="shipment-detail-side">
      <Card>
        <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">关联订单</h2></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <ContextMetric label="订单号" value={shipment.order_number || shipment.order_id} />
            <ContextMetric label="平台/店铺" value={`${shipment.platform?.toUpperCase() || '--'} · ${shipment.platform_account_name || '店铺待补'}`} />
            <ContextMetric label="买家" value={shipment.buyer_name || '买家待补'} />
            <ContextMetric
              label="平台发货时限"
              value={shipment.fulfillment_deadline_at ? new Date(shipment.fulfillment_deadline_at).toLocaleString('zh-CN') : '待平台同步'}
              tone={shipment.fulfillment_exception?.severity === 'critical' ? 'danger' : shipment.fulfillment_exception?.severity === 'warning' ? 'warning' : 'default'}
            />
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onOpenOrder}>查看订单</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function OrderShipmentContextPanel({
  order,
  loading,
  orderId,
  onBackToOrder,
}: {
  order: OrderDetail | null
  loading: boolean
  orderId: string
  onBackToOrder: () => void
}) {
  if (loading) return <Skeleton className="h-40 w-full" />
  if (!order) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted)]">
            订单发货上下文待补：{orderId ? `未能读取订单 ${orderId}` : '请先从订单详情或履约异常队列进入新建物流。'}
          </div>
        </CardContent>
      </Card>
    )
  }
  const exception = order.fulfillment_exception || {}
  const firstReason = (exception.reasons || [])[0]
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Order Fulfillment Context</p>
            <h2 className="mt-1 font-semibold text-[var(--color-fg)]">订单发货上下文</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">创建物流前先核对订单、平台发货时限、买家地址、物流缺口和对账状态。</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onBackToOrder}>返回订单详情</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <ContextMetric label="订单号" value={order.order_number || order.platform_order_id} />
          <ContextMetric label="平台/店铺" value={`${order.platform.toUpperCase()} · ${order.source === 'manual' ? '手工订单' : '平台订单'}`} />
          <ContextMetric label="订单金额" value={`${order.currency} ${order.total.toFixed(2)}`} />
          <ContextMetric label="商品件数" value={`${order.items?.length || 0} 项`} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ContextMetric label="平台发货时限" value={order.fulfillment_deadline_at ? new Date(order.fulfillment_deadline_at).toLocaleString('zh-CN') : '待平台同步'} tone={exception.status === 'shipping_overdue' ? 'danger' : exception.status === 'shipping_due_soon' ? 'warning' : 'default'} />
          <ContextMetric label="现有物流渠道" value={order.logistics_channel || '待补'} tone={order.logistics_channel ? 'default' : 'warning'} />
          <ContextMetric label="履约异常" value={firstReason || fulfillmentStatusLabel(exception.status)} tone={exception.severity === 'critical' ? 'danger' : exception.severity === 'warning' ? 'warning' : 'default'} />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="text-xs text-[var(--color-muted)]">买家与收货地址</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">{order.buyer_name || '买家待补'}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{shippingAddressText(order.shipping_address)}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ContextMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value?: string | null
  tone?: 'default' | 'warning' | 'danger'
}) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold" style={{ color }}>{value || '待补'}</p>
    </div>
  )
}

export function shippingAddressValue(address: Record<string, unknown>, key: string): string {
  const value = address[key]
  return typeof value === 'string' ? value : ''
}

function shippingAddressText(address?: Record<string, unknown> | null): string {
  if (!address) return '收货地址待平台同步'
  const parts = ['country', 'province', 'state', 'city', 'district', 'address', 'full_address']
    .map(key => shippingAddressValue(address, key))
    .filter(Boolean)
  return parts.length ? Array.from(new Set(parts)).join(' / ') : '收货地址待补'
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
