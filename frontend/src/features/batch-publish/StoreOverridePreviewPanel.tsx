import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft } from '../../api/listing'

export function StoreOverridePreviewPanel({ draft }: { draft: BatchListingDraft }) {
  const override = draft.listing_store_override
  const hasOverride = Boolean(override?.store_id || override?.title || override?.sku_count || override?.has_logistics || override?.has_compliance || override?.has_platform_attributes)
  const storeLabel = override?.store_label || draft.store?.account_name || '当前目标店铺'
  const sourceLabel = hasOverride ? '来自当前店铺覆盖版本' : '来自基础商品/草稿字段'
  const rows = [
    {
      label: 'SKU/变体来源',
      value: override?.sku_count ? `店铺覆盖 ${override.sku_count} 个规格` : draft.sku_plan?.master_sku ? '基础主 SKU' : '待补 SKU',
      active: Boolean(override?.sku_count),
    },
    {
      label: '物流来源',
      value: override?.has_logistics ? '店铺覆盖重量、尺寸、物流模板' : draft.logistics?.weight_g ? '基础物流字段' : '待补物流',
      active: Boolean(override?.has_logistics),
    },
    {
      label: '合规来源',
      value: override?.has_compliance ? '店铺覆盖合规与禁限售状态' : draft.compliance?.restricted_check_status ? '基础合规字段' : '待补合规',
      active: Boolean(override?.has_compliance),
    },
    {
      label: '平台属性来源',
      value: override?.has_platform_attributes ? '店铺覆盖平台字段值' : draft.platform_requirements?.attribute_values ? '平台字段草稿' : '待补平台属性',
      active: Boolean(override?.has_platform_attributes),
    },
  ]

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5" aria-label="发布预览店铺覆盖来源">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">店铺覆盖版本</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
            {storeLabel} · {hasOverride ? (override?.title || sourceLabel) : '未使用店铺覆盖版本'}
          </p>
        </div>
        <Badge variant={hasOverride ? 'success' : 'warning'}>
          {hasOverride ? '已接入覆盖' : '未使用覆盖'}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {rows.map(row => (
          <div key={row.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--color-muted)]">{row.label}</span>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: row.active ? 'var(--color-success)' : 'var(--color-warning)' }}
              />
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--color-fg)]">{row.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">
        覆盖字段只作用于当前平台店铺草稿，不回写基础商品版本，也不会影响同商品在其他店铺的 Listing。
      </p>
    </div>
  )
}
