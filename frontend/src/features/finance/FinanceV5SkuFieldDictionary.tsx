import type { UnifiedFieldDictionary } from '../../api/config'
import type { FinanceTracebackProduct } from '../../api/finance'

type FinanceV5SkuFieldRow = {
  key: string
  standardLabel: string
  platformField: string
  dataType: string
  value: string
}

export function FinanceV5SkuFieldDictionary({
  products,
  unified_field_dictionary,
}: {
  products: FinanceTracebackProduct[]
  unified_field_dictionary?: UnifiedFieldDictionary
}) {
  const rows = products.flatMap(product =>
    financeV5SkuFieldRows(product, unified_field_dictionary).map(row => ({
      ...row,
      productName: product.product_name || product.product_id,
      platform: product.platform || '平台待识别',
    })),
  )
  if (!rows.length) return null
  return (
    <div data-ui="finance-v5-sku-field-dictionary" className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">V5 SKU 字段字典回溯</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            财务回溯只读取店铺 Listing 的 SKU 上下文，按统一字段字典显示标准字段和平台字段，不用 SKU 上下文反推收入、成本或利润。
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[11px] text-[var(--color-primary)]">
          字段 {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
              <th className="py-2 pr-3 font-medium">商品</th>
              <th className="py-2 pr-3 font-medium">标准字段</th>
              <th className="py-2 pr-3 font-medium">平台字段</th>
              <th className="py-2 pr-3 font-medium">类型</th>
              <th className="py-2 pr-3 font-medium">回溯值</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.productName}-${row.platform}-${row.key}-${row.value}`} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2 pr-3 text-[var(--color-fg)]">{row.productName}</td>
                <td className="py-2 pr-3 text-[var(--color-fg)]">{row.standardLabel}</td>
                <td className="py-2 pr-3 text-[var(--color-muted)]">{row.platformField}</td>
                <td className="py-2 pr-3 text-[var(--color-muted)]">{row.dataType}</td>
                <td className="py-2 pr-3 text-[var(--color-fg)]">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function financeV5SkuFieldRows(
  product: FinanceTracebackProduct,
  unified_field_dictionary?: UnifiedFieldDictionary,
): FinanceV5SkuFieldRow[] {
  const context = product.v5_sku_contexts?.find(item => item.status === 'matched') || product.v5_sku_contexts?.[0]
  if (!context) return []
  const spu_skc = [context.spu, context.skc].filter(Boolean).join(' / ')
  const skuOptions = [context.option_1?.value, context.option_2?.value].filter(Boolean).join(' / ')
  const sku_image_role = context.sku_image_url ? 'SKU 图片已绑定' : ''
  return [
    buildFinanceV5SkuFieldRow(['sku_id', 'merchant_sku'], 'merchant_sku', '商家 SKU', context.merchant_sku || context.ledger_sku, product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['sku_id', 'platform_sku'], 'platform_sku', '平台 SKU', context.platform_sku, product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['spu_id', 'skc_id'], 'spu_skc', 'SPU / SKC', spu_skc, product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['sku_name'], 'sku_options', '规格组合', skuOptions, product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['sku_images', 'sku_image_list'], 'sku_image_role', 'SKU 图片角色', sku_image_role || context.sku_image_url, product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['sku_stock'], 'listing_stock', 'Listing 库存', formatOptionalFinanceValue(context.listing_stock), product.platform, unified_field_dictionary),
    buildFinanceV5SkuFieldRow(['sku_price'], 'listing_price', 'Listing 价格', formatOptionalFinanceValue(context.listing_price), product.platform, unified_field_dictionary),
  ].filter(row => row.value && row.value !== '--')
}

function buildFinanceV5SkuFieldRow(
  candidateKeys: string[],
  key: string,
  fallbackLabel: string,
  value: string | number | null | undefined,
  platform: string | null | undefined,
  unified_field_dictionary?: UnifiedFieldDictionary,
): FinanceV5SkuFieldRow {
  const field = unified_field_dictionary?.fields?.find(item => candidateKeys.includes(item.key))
  const platformKey = normalizeFinancePlatformKey(platform)
  const platformField = field?.platforms?.[platformKey]?.field || field?.platforms?.miaoshou?.field || '平台字段待映射'
  return {
    key,
    standardLabel: financeStandardFieldLabel(field?.label, fallbackLabel),
    platformField: `${platform || '平台待识别'} 字段：${platformField}`,
    dataType: field?.data_type || 'text',
    value: value == null || value === '' ? '--' : String(value),
  }
}

function financeStandardFieldLabel(label: string | undefined, fallback: string) {
  return label && label.trim() ? label : fallback
}

function formatOptionalFinanceValue(value: number | null | undefined) {
  return value == null ? '--' : String(value)
}

function normalizeFinancePlatformKey(platform: string | null | undefined) {
  const value = (platform || '').toLowerCase()
  if (value.includes('tiktok')) return 'tiktok'
  if (value.includes('temu')) return 'temu'
  if (value.includes('shopee')) return 'shopee'
  return value
}
