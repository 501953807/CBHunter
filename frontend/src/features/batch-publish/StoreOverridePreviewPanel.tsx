import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft } from '../../api/listing'

export function StoreOverridePreviewPanel({ draft }: { draft: BatchListingDraft }) {
  const override = draft.listing_store_override
  const hasOverride = Boolean(override?.store_id || override?.title || override?.sku_count || override?.has_logistics || override?.has_compliance || override?.has_platform_attributes)
  const storeLabel = override?.store_label || draft.store?.account_name || '当前目标店铺'
  const sourceLabel = hasOverride ? '来自当前店铺覆盖版本' : '来自基础商品/草稿字段'
  const fallbackFieldSources = {
    title: override?.title ? 'listing_store_override' : 'draft',
    sku_plan: override?.sku_count ? 'listing_store_override' : 'draft',
    media_assets: override?.image_count ? 'listing_store_override' : 'draft',
    logistics: override?.has_logistics ? 'listing_store_override' : 'draft',
    compliance: override?.has_compliance ? 'listing_store_override' : 'draft',
    platform_requirements: override?.has_platform_attributes ? 'listing_store_override' : 'draft',
  }
  const fieldSources = draft.field_sources || fallbackFieldSources
  const sourceRows = [
    ['标题', fieldSources.title],
    ['SKU/变体', fieldSources.sku_plan],
    ['图片素材', fieldSources.media_assets],
    ['物流包装', fieldSources.logistics],
    ['合规资料', fieldSources.compliance],
    ['平台属性', fieldSources.platform_requirements],
  ]
  const rows = [
    {
      label: 'SKU/变体来源',
      value: override?.sku_count ? `店铺覆盖 ${override.sku_count} 个规格` : draft.sku_plan?.master_sku ? '基础主 SKU' : '待补 SKU',
      active: Boolean(override?.sku_count),
    },
    {
      label: 'SKU平台映射',
      value: override?.sku_platform_mapping_count
        ? `映射 ${override.sku_platform_mapping_count} 行 / 缺口 ${override.sku_platform_mapping_gap_count || 0}`
        : '待补平台SKU字段映射',
      active: Boolean(override?.sku_platform_mapping_count && !override?.sku_platform_mapping_gap_count),
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
      <div
        className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
        aria-label="店铺覆盖SKU平台字段映射状态"
        data-ui="batch-publish-sku-platform-mapping-summary"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-[var(--color-fg)]">SKU平台字段映射</p>
          <Badge variant={override?.sku_platform_mapping_count && !override?.sku_platform_mapping_gap_count ? 'success' : 'warning'}>
            {override?.sku_platform_mapping_count ? `${override.sku_platform_mapping_count} 行` : '待补'}
          </Badge>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[var(--color-muted)]">
          {override?.sku_platform_mapping_count
            ? `内容工厂已写入平台 SKU 映射摘要，发布前仍有 ${override.sku_platform_mapping_gap_count || 0} 个映射缺口。`
            : '批量刊登未读取到内容工厂 SKU 平台映射，请回内容工厂补齐商家SKU、平台SKU/SPU/SKC、规格、价格、库存和SKU图。'}
        </p>
      </div>
      <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2" aria-label="字段来源矩阵">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-[var(--color-fg)]">字段来源矩阵</p>
          <span className="text-[10px] text-[var(--color-muted)]">{draft.override_boundary || override?.override_boundary || '店铺 Listing 独立覆盖边界'}</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {sourceRows.map(([label, source]) => (
            <div key={label} className="rounded border border-[var(--color-border)] px-1.5 py-1">
              <span className="text-[10px] text-[var(--color-muted)]">{label}</span>
              <p className={source === 'listing_store_override' ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-warning)]'}>
                {source === 'listing_store_override' ? '店铺覆盖' : '草稿/基础'}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[var(--color-muted)]">
        店铺 Listing 独立覆盖边界：覆盖字段只作用于当前平台店铺草稿，不回写基础商品版本，也不会影响同商品在其他店铺的 Listing。
      </p>
    </div>
  )
}
