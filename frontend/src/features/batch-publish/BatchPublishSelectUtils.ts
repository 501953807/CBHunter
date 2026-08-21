import type { PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import type { ListingMasterStatus } from '../../api/listing'

export interface PublishableItem {
  key: string
  id: string
  sourceType: 'sourcing' | 'product'
  name: string
  costPrice: number | null
  sellingPrice?: number | null
  pricingSourceLabel?: string
  pricingConfirmation?: Record<string, unknown> | null
  imageUrl?: string | null
  platformRequirements?: {
    required_attributes?: string[]
    media?: string[]
    content?: string[]
    compliance?: string[]
    attribute_values?: Record<string, unknown>
    field_groups?: unknown[]
    object_model?: string[]
    evidence_source?: string
  }
  platformRequirementsByPlatform?: Record<string, PlatformRequirementsLike>
  listingMasterStatus?: ListingMasterStatus
  listingStoreOverride?: {
    store_id?: string | null
    store_label?: string | null
    title?: string | null
    image_count?: number
    sku_count?: number
    sku_platform_mapping_count?: number
    sku_platform_mapping_gap_count?: number
    has_platform_attributes?: boolean
    has_logistics?: boolean
    has_compliance?: boolean
    override_boundary?: string | null
  }
  targetPlatforms?: string[]
  targetMarkets?: string[]
  targetStoreIds?: string[]
  mediaReadiness?: {
    captured_image_count?: number
    missing_image_count?: number
    min_platform_images?: number
    recommended_platform_images?: number
    publish_image_limit?: number | null
    retained_image_count?: number
    gaps?: string[]
    source?: string
  }
  lifecycleLabel?: string
  disabled?: boolean
  disabledReason?: string
}

export function publishReadiness(
  item: PublishableItem,
  selectedPlatforms: Set<string>,
  selectedMarkets: Set<string>,
  selectedStores: Set<string>,
) {
  const captured = item.mediaReadiness?.captured_image_count ?? (item.imageUrl ? 1 : 0)
  const minImages = item.mediaReadiness?.min_platform_images ?? 5
  const retainedImages = item.mediaReadiness?.retained_image_count ?? 0
  const sourceLabel = mediaSourceLabel(item.mediaReadiness?.source)
  const sourceStateLabel = isTrustedMediaSource(item.mediaReadiness?.source) ? sourceLabel : `${sourceLabel}待复核`
  const mediaReady = captured >= minImages
  const requirements = item.platformRequirements
  const requiredAttrs = requirements?.required_attributes || []
  const attrValues = requirements?.attribute_values || {}
  const missingAttrs = requiredAttrs.filter(attr => !hasAttributeValue(attrValues[attr]))
  const fieldReady = requiredAttrs.length > 0 && missingAttrs.length === 0
  const priceReady = item.sellingPrice != null || Boolean(pricingTemplateSnapshot(item))
  const targetReady = selectedPlatforms.size > 0 && selectedMarkets.size > 0 && selectedStores.size > 0
  const masterReady = item.listingMasterStatus?.ready ?? (item.sourceType === 'product')
  const ready = masterReady && mediaReady && fieldReady && priceReady && targetReady && !item.disabled
  return {
    ready,
    masterReady,
    mediaReady,
    fieldReady,
    priceReady,
    targetReady,
    missingAttrs,
    mediaLabel: `发布图 ${captured}/${minImages}${retainedImages ? ` · 素材池 ${retainedImages}` : ''} · ${sourceStateLabel}`,
  }
}

export type PublishReadiness = ReturnType<typeof publishReadiness>

export function mediaSourceLabel(source?: string) {
  if (source === 'confirmed_image_slot_plan' || source === 'listing_image_slot_plan') return '已确认图片槽位计划'
  if (source === 'stored_media_readiness') return '历史媒体就绪度'
  return '原始素材'
}

export function isTrustedMediaSource(source?: string) {
  return source === 'confirmed_image_slot_plan' || source === 'listing_image_slot_plan'
}

export function pricingTemplateSnapshot(item: PublishableItem) {
  const confirmation = item.pricingConfirmation
  if (!confirmation || typeof confirmation !== 'object') return null
  const snapshot = confirmation.pricing_template_snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  return snapshot as Record<string, unknown>
}

export function buildPreviewDisabledReason(
  loading: boolean,
  selectedItems: Set<string>,
  selectedPlatforms: Set<string>,
  selectedMarkets: Set<string>,
  selectedStores: Set<string>,
) {
  if (loading) return '正在生成预览'
  if (selectedItems.size === 0) return '请选择至少一个商品'
  if (selectedPlatforms.size === 0) return '请选择至少一个目标平台'
  if (selectedStores.size === 0) return '请选择至少一个目标店铺'
  if (selectedMarkets.size === 0) return '目标店铺缺少市场归属，请先在店铺配置维护市场'
  return '生成 Listing 预览'
}

export function buildSelectedBlockingReason(counts: { total: number; master: number; media: number; fields: number; price: number; target: number }) {
  if (counts.total === 0) return ''
  const parts = [
    counts.master ? `Listing母版 ${counts.master}` : '',
    counts.media ? `发布图 ${counts.media}` : '',
    counts.fields ? `平台字段 ${counts.fields}` : '',
    counts.price ? `定价 ${counts.price}` : '',
    counts.target ? `目标归属 ${counts.target}` : '',
  ].filter(Boolean)
  return `已选商品仍有发布阻断：${parts.join('、')}。请先处理后再生成 Listing 预览。`
}

function hasAttributeValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}
