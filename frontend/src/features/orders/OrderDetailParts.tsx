import { ArrowLeft, Truck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import type { UnifiedFieldDictionary } from '../../api/config'
import type { OrderDetail, OrderItem } from '../../types/order'

export {
  OrderFeeSummaryPanel,
  OrderFinanceEntryPanel,
  OrderFulfillmentExceptionPanel,
  OrderPlatformFeeBreakdownPanel,
  OrderPlatformSyncReviewPanel,
  OrderShippingAddressPanel,
  RelatedShipmentsPanel,
  fulfillmentBadgeVariant,
  fulfillmentStatusLabel,
  InfoRow,
  MoneyRow,
  reconciliationText,
  syncBadgeVariant,
  syncStatusLabel,
} from './OrderDetailOperationalPanels'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

type OrderV5SkuFieldRow = {
  key: string
  label: string
  platformField: string
  dataType: string
  value: string
}

export function OrderDetailHero({
  order,
  badge,
  onBack,
}: {
  order: OrderDetail
  badge: { label: string; variant: BadgeVariant }
  onBack: () => void
}) {
  return (
    <div className="order-detail-hero">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[var(--color-muted)] hover:text-[var(--color-muted)]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">
            订单 {order.order_number || order.platform_order_id?.slice(0, 12)}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Badge variant={order.source === 'manual' ? 'warning' : 'outline'}>{order.source === 'manual' ? '手工录入' : '平台数据'}</Badge>
            <span className="text-xs text-[var(--color-muted)]">
              {order.platform} · {order.ordered_at ? new Date(order.ordered_at).toLocaleString('zh-CN') : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OrderManualSourceWarning({ source }: { source: string }) {
  if (source !== 'manual') return null
  return (
    <p className="rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
      该订单由人工录入，尚未经过平台 API 对账；财务收入需按真实收款另行入账。
    </p>
  )
}

export function OrderItemsPanel({
  order,
  unifiedFieldDictionary,
}: {
  order: OrderDetail
  unifiedFieldDictionary: UnifiedFieldDictionary | undefined
}) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">商品明细</h2></CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
              <th className="pb-2 font-medium">商品</th>
              <th className="pb-2 font-medium">SKU</th>
              <th className="pb-2 text-right font-medium">数量</th>
              <th className="pb-2 text-right font-medium">单价</th>
              <th className="pb-2 text-right font-medium">小计</th>
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
          <OrderV5SkuDictionaryPanel order={order} unifiedFieldDictionary={unifiedFieldDictionary} />
        )}
      </CardContent>
    </Card>
  )
}

function OrderV5SkuDictionaryPanel({
  order,
  unifiedFieldDictionary,
}: {
  order: OrderDetail
  unifiedFieldDictionary: UnifiedFieldDictionary | undefined
}) {
  return (
    <div data-ui="order-v5-sku-field-dictionary" className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-fg)]">V5 SKU 字段字典说明</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          订单项只读取店铺 Listing 的 V5 SKU 上下文，不反写订单金额；字段名称来自统一字段字典，平台字段名按当前订单平台展示。
        </p>
      </div>
      <div className="space-y-3">
        {(order.items || []).map(item => {
          const rows = orderV5SkuFieldRows(item, unifiedFieldDictionary, order.platform)
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
  )
}

export function OrderTimelinePanel({ order, statusLabel }: { order: OrderDetail; statusLabel: string }) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">时间线</h2></CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
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
            <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
            <div>
              <p className="text-sm text-[var(--color-fg)]">当前状态 ({statusLabel})</p>
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
  )
}

export function OrderNotesPanel({
  notes,
  saving,
  onChange,
  onSave,
}: {
  notes: string
  saving: boolean
  onChange: (value: string) => void
  onSave: () => void
}) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">备注</h2></CardHeader>
      <CardContent>
        <textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          placeholder="添加备注..."
        />
        <Button size="sm" variant="secondary" onClick={onSave} disabled={saving}>
          保存备注
        </Button>
      </CardContent>
    </Card>
  )
}

export function OrderActionsPanel({
  allowedTransitions,
  onMarkProcessing,
  onCreateShipment,
  onCancel,
}: {
  allowedTransitions: string[]
  onMarkProcessing: () => void
  onCreateShipment: () => void
  onCancel: () => void
}) {
  if (allowedTransitions.length === 0) return null
  return (
    <Card>
      <CardHeader><h2 className="font-semibold text-[var(--color-fg)]">操作</h2></CardHeader>
      <CardContent className="flex gap-2">
        {allowedTransitions.includes('processing') && (
          <Button onClick={onMarkProcessing}>标记处理中</Button>
        )}
        {allowedTransitions.includes('shipped') && (
          <Button onClick={onCreateShipment}>
            <Truck className="mr-1.5 h-4 w-4" />
            创建物流发货
          </Button>
        )}
        {allowedTransitions.includes('cancelled') && (
          <Button variant="danger" onClick={onCancel}>取消订单</Button>
        )}
      </CardContent>
    </Card>
  )
}

export function orderV5SkuFieldRows(
  item: OrderItem,
  unified_field_dictionary: UnifiedFieldDictionary | undefined,
  platform: string,
): OrderV5SkuFieldRow[] {
  const context = item.v5_sku_context
  if (!context) return []
  const spu_skc = [context.spu, context.skc].filter(Boolean).join(' / ')
  const optionValue = [context.option_1, context.option_2]
    .filter(Boolean)
    .map(option => [option?.name, option?.value].filter(Boolean).join(': '))
    .filter(Boolean)
    .join('；')
  const sku_image_role = context.sku_image_url ? 'SKU 图片已绑定' : ''
  return [
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_id', 'merchant_sku'], 'merchant_sku', '商家 SKU', context.merchant_sku || item.sku),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_id', 'platform_sku'], 'platform_sku', '平台 SKU', context.platform_sku),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['spu_id', 'skc_id'], 'spu_skc', 'SPU / SKC', spu_skc),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_name'], 'sku_options', '规格组合', optionValue),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_images', 'sku_image_list'], 'sku_image_role', 'SKU 图片角色', sku_image_role || context.sku_image_url),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_stock'], 'listing_stock', 'Listing 库存', formatOptionalNumber(context.listing_stock)),
    buildOrderV5SkuFieldRow(unified_field_dictionary, platform, ['sku_price'], 'listing_price', 'Listing 价格', formatOptionalNumber(context.listing_price)),
  ].filter(row => row.value && row.value !== '--')
}

function buildOrderV5SkuFieldRow(
  unified_field_dictionary: UnifiedFieldDictionary | undefined,
  platform: string,
  candidateKeys: string[],
  key: string,
  fallbackLabel: string,
  value: string | number | null | undefined,
): OrderV5SkuFieldRow {
  const field = candidateKeys
    .map(candidate => unified_field_dictionary?.fields.find(item => item.key === candidate))
    .find(Boolean)
  const platformKey = normalizePlatformKey(platform)
  const platformName = field?.platforms?.[platformKey]?.field || field?.platforms?.miaoshou?.field || '平台字段待映射'
  return {
    key,
    label: standardFieldLabel(unified_field_dictionary, candidateKeys, fallbackLabel),
    platformField: `${platform || '平台待识别'} 字段：${platformName}`,
    dataType: field?.data_type || 'string',
    value: value == null || value === '' ? '--' : String(value),
  }
}

function standardFieldLabel(
  unified_field_dictionary: UnifiedFieldDictionary | undefined,
  candidateKeys: string[],
  fallbackLabel: string,
) {
  return candidateKeys
    .map(candidate => unified_field_dictionary?.fields.find(item => item.key === candidate)?.label)
    .find(Boolean) || fallbackLabel
}

function normalizePlatformKey(platform: string) {
  const value = platform.toLowerCase()
  if (value.includes('tiktok')) return 'tiktok'
  if (value.includes('temu')) return 'temu'
  if (value.includes('shopee')) return 'shopee'
  return value
}

function formatOptionalNumber(value?: number | null) {
  return value == null ? '' : String(value)
}
