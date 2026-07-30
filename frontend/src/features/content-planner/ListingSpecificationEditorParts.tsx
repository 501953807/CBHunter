import type { ContentAsset } from '../../api/content'
import { logger } from '../../utils/logger'

export type SkuDraft = {
  enabled: boolean
  sku: string
  platformSku: string
  spuSkc: string
  variation: string
  imageRole: string
  imageUrl: string
  price: string
  stock: string
  weight: string
  length: string
  width: string
  height: string
  barcode: string
}

export type SkuGenerationDraft = {
  specOneName: string
  specOneValues: string
  specTwoName: string
  specTwoValues: string
  skuPrefix: string
  price: string
  stock: string
  weight: string
}

export type SkuReadinessRow = {
  rowNumber: number
  variation: string
  blockingGaps: string[]
  warningGaps: string[]
}

export type SkuPlatformMappingRow = {
  rowNumber: number
  platform: string
  seller_sku: string
  platform_sku_field: string
  variation_field: string
  stock_field: string
  price_field: string
  image_field: string
  required_gaps: string[]
}

export type LogisticsDraft = {
  weight: string
  length: string
  width: string
  height: string
  packageType: string
  shippingSla: string
}

export type ListingOverridePayload = {
  schema?: string
  product_id?: string
  product_name?: string
  base_platform?: string | null
  base_market?: string | null
  store_id?: string | null
  store_label?: string | null
  override_boundary?: string
  title?: string
  short_description?: string
  long_description?: string
  price?: string
  currency?: string
  image_urls?: string[]
  video_url?: string
  skus?: {
    enabled?: boolean
    seller_sku?: string
    platform_sku?: string
    spu_skc?: string
    variation?: string
    sku_image_role?: string
    sku_image_url?: string
    price?: string
    stock?: string
    weight_g?: string
    length_cm?: string
    width_cm?: string
    height_cm?: string
    barcode?: string
  }[]
  sku_platform_mapping?: SkuPlatformMappingRow[]
  platform_attributes_note?: string
  logistics_note?: string
  compliance_note?: string
  promotion_note?: string
}

export const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]'

export function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-[var(--color-muted)]">
      {label}
      <input className={inputClass} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

export function PlatformRequiredFieldStatusTable({ requiredAttrs, values }: { requiredAttrs: string[]; values: Record<string, unknown> }) {
  return (
    <div aria-label="平台必填字段状态表" className="mb-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">平台字段</th>
            <th className="px-3 py-2 font-medium">字段状态</th>
            <th className="px-3 py-2 font-medium">当前值</th>
          </tr>
        </thead>
        <tbody>
          {requiredAttrs.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-3 text-[var(--color-muted)]">当前平台/类目还没有已确认必填字段，需继续补证平台字段组。</td>
            </tr>
          )}
          {requiredAttrs.map(field => {
            const filled = hasValue(values[field])
            return (
              <tr key={field} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-semibold text-[var(--color-fg)]">{field}</td>
                <td className={filled ? 'px-3 py-2 text-[var(--color-success)]' : 'px-3 py-2 text-[var(--color-warning)]'}>
                  {filled ? '已填写' : '待填写'}
                </td>
                <td className="px-3 py-2 text-[var(--color-muted)]">{formatFieldValue(values[field])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SpecCheck({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{label}</p>
        <span className={ok ? 'text-xs font-semibold text-[var(--color-success)]' : 'text-xs font-semibold text-[var(--color-warning)]'}>{ok ? '通过' : '待补'}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

export function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

export function emptySkuDraft(): SkuDraft {
  return {
    enabled: true,
    sku: '',
    platformSku: '',
    spuSkc: '',
    variation: '',
    imageRole: 'sku_main',
    imageUrl: '',
    price: '',
    stock: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    barcode: '',
  }
}

export function emptySkuGenerationDraft(): SkuGenerationDraft {
  return {
    specOneName: '颜色',
    specOneValues: '',
    specTwoName: '尺码',
    specTwoValues: '',
    skuPrefix: '',
    price: '',
    stock: '',
    weight: '',
  }
}

export function splitSpecValues(value: string): string[] {
  return value
    .split(/[,，、\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function buildVariationLabel(generator: SkuGenerationDraft, valueOne: string, valueTwo: string): string {
  return [
    `${generator.specOneName.trim()}: ${valueOne}`,
    valueTwo && generator.specTwoName.trim() ? `${generator.specTwoName.trim()}: ${valueTwo}` : '',
  ].filter(Boolean).join(' / ')
}

export function contentAssetImageUrl(asset: ContentAsset): string {
  const explicitUrl = asset.extra?.url ? String(asset.extra.url) : ''
  return explicitUrl || `/api/v1/content/assets/${asset.id}/file`
}

export function isSkuDraftMeaningful(row: SkuDraft): boolean {
  return Boolean(
    row.sku || row.platformSku || row.spuSkc || row.variation || row.imageUrl ||
    row.price || row.stock || row.weight || row.length || row.width || row.height || row.barcode
  )
}

export function buildSkuReadinessRows(rows: SkuDraft[], platform?: string | null): SkuReadinessRow[] {
  const normalizedPlatform = String(platform || '').toLowerCase()
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.enabled && isSkuDraftMeaningful(row))
    .map(({ row, index }) => {
      const blockingGaps: string[] = []
      const warningGaps: string[] = []
      if (!row.sku.trim()) blockingGaps.push('商家SKU')
      if (!row.variation.trim()) blockingGaps.push('变体属性')
      if (!row.price.trim()) blockingGaps.push('售价')
      if (!row.stock.trim()) blockingGaps.push('库存')
      if (!row.weight.trim()) blockingGaps.push('重量')
      if (!row.length.trim() || !row.width.trim() || !row.height.trim()) blockingGaps.push('包裹长宽高')
      if (normalizedPlatform.includes('temu') && !row.spuSkc.trim()) blockingGaps.push('SPU/SKC')
      if ((normalizedPlatform.includes('shopee') || normalizedPlatform.includes('tiktok')) && !row.platformSku.trim()) warningGaps.push('平台SKU/Model ID')
      if (!row.imageUrl.trim()) warningGaps.push('SKU图片')
      if (!row.barcode.trim()) warningGaps.push('条码/货号')
      return {
        rowNumber: index + 1,
        variation: row.variation.trim(),
        blockingGaps,
        warningGaps,
      }
    })
}

export function buildSkuPlatformMappingRows(rows: SkuDraft[], platform?: string | null): SkuPlatformMappingRow[] {
  const config = skuPlatformFieldConfig(platform)
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.enabled && isSkuDraftMeaningful(row))
    .map(({ row, index }) => {
      const requiredGaps: string[] = []
      if (!row.sku.trim()) requiredGaps.push(config.sellerSkuLabel)
      if (!row.variation.trim()) requiredGaps.push(config.variationLabel)
      if (!row.price.trim()) requiredGaps.push(config.priceLabel)
      if (!row.stock.trim()) requiredGaps.push(config.stockLabel)
      if (config.requirePlatformSku && !row.platformSku.trim()) requiredGaps.push(config.platformSkuLabel)
      if (config.requireSpuSkc && !row.spuSkc.trim()) requiredGaps.push(config.spuSkcLabel)
      if (!row.imageUrl.trim()) requiredGaps.push(config.imageLabel)
      return {
        rowNumber: index + 1,
        platform: config.platform,
        seller_sku: row.sku.trim(),
        platform_sku_field: `${config.platformSkuLabel}: ${row.platformSku.trim() || row.spuSkc.trim() || '待补'}`,
        variation_field: `${config.variationLabel}: ${row.variation.trim() || '待补'}`,
        stock_field: `${config.stockLabel}: ${row.stock.trim() || '待补'}`,
        price_field: `${config.priceLabel}: ${row.price.trim() || '待补'}`,
        image_field: `${config.imageLabel}: ${row.imageUrl.trim() ? '已绑定' : '待补'}`,
        required_gaps: requiredGaps,
      }
    })
}

function skuPlatformFieldConfig(platform?: string | null) {
  const normalized = String(platform || '').toLowerCase()
  if (normalized.includes('temu')) {
    return {
      platform: 'TEMU',
      sellerSkuLabel: '货号 / Seller SKU',
      platformSkuLabel: '平台SKU',
      spuSkcLabel: 'SPU/SKC',
      variationLabel: '规格属性',
      stockLabel: '库存',
      priceLabel: '供货价/申报价',
      imageLabel: 'SKU图片',
      requirePlatformSku: false,
      requireSpuSkc: true,
    }
  }
  if (normalized.includes('tiktok')) {
    return {
      platform: 'TikTok Shop',
      sellerSkuLabel: 'Seller SKU',
      platformSkuLabel: 'Variation ID / Seller SKU',
      spuSkcLabel: 'SPU/SKC',
      variationLabel: 'Variation / Sales Attribute',
      stockLabel: '库存',
      priceLabel: '售价',
      imageLabel: 'Variation Image',
      requirePlatformSku: true,
      requireSpuSkc: false,
    }
  }
  return {
    platform: 'Shopee',
    sellerSkuLabel: '商家SKU',
    platformSkuLabel: 'Model ID / 平台SKU',
    spuSkcLabel: 'SPU/SKC',
    variationLabel: 'Variation / 规格',
    stockLabel: '库存',
    priceLabel: '售价',
    imageLabel: 'SKU图片',
    requirePlatformSku: true,
    requireSpuSkc: false,
  }
}

export function parseListingOverridePayload(content: string): ListingOverridePayload | null {
  if (!content.trim()) return null
  try {
    const payload = JSON.parse(content) as ListingOverridePayload
    return payload.schema === 'listing_store_override.v1' ? payload : null
  } catch (error: any) {
    logger.error('Parse listing override payload failed in specification editor', error)
    return null
  }
}

export function normalizeSkuDrafts(value: ListingOverridePayload['skus']): SkuDraft[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(row => row && (
      row.seller_sku || row.platform_sku || row.spu_skc || row.variation || row.sku_image_url ||
      row.price || row.stock || row.weight_g || row.length_cm || row.width_cm || row.height_cm || row.barcode
    ))
    .map(row => ({
      enabled: row.enabled !== false,
      sku: row.seller_sku || '',
      platformSku: row.platform_sku || '',
      spuSkc: row.spu_skc || '',
      variation: row.variation || '',
      imageRole: row.sku_image_role || 'sku_main',
      imageUrl: row.sku_image_url || '',
      price: row.price || '',
      stock: row.stock || '',
      weight: row.weight_g || '',
      length: row.length_cm || '',
      width: row.width_cm || '',
      height: row.height_cm || '',
      barcode: row.barcode || '',
    }))
}

export function parseLogisticsDraft(value: string): LogisticsDraft | null {
  if (!value.trim()) return null
  try {
    const parsed = JSON.parse(value) as Partial<LogisticsDraft>
    return {
      weight: parsed.weight || '',
      length: parsed.length || '',
      width: parsed.width || '',
      height: parsed.height || '',
      packageType: parsed.packageType || '',
      shippingSla: parsed.shippingSla || '',
    }
  } catch (error: any) {
    logger.error('Parse logistics draft failed in specification editor', error)
    return null
  }
}

function formatFieldValue(value: unknown) {
  if (!hasValue(value)) return '--'
  if (Array.isArray(value)) return value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
