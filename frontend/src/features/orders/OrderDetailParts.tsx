import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import { Skeleton } from '../../components/shared/LoadingSkeleton'
import type { UnifiedFieldDictionary } from '../../api/config'
import type { OrderFinanceEntryContext, OrderItem } from '../../types/order'
import type { Shipment } from '../../types/shipment'

type OrderV5SkuFieldRow = {
  key: string
  label: string
  platformField: string
  dataType: string
  value: string
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

