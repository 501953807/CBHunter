import type { ContentWorkbenchItem } from '../../api/content'
import type { PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'

export type SellerSkuRow = {
  id: string
  optionOne: string
  optionTwo: string
  merchantSku: string
  platformSku: string
  skuImageRole: string
  price: string
  stock: string
  weight: string
  dimensions: string
  enabled: boolean
}

export type ListingImageSlot = {
  id: string
  label: string
  role: string
  imageUrl: string
  required: boolean
}

export type ListingGap = {
  id: string
  label: string
  anchor: string
  targetId: string
  severity: 'blocker' | 'warning'
}

type PlatformFieldLike = {
  key?: string
  label?: string
  unified_field_key?: string
  standard_label?: string
  platform_field_name?: string
  miaoshou_field_name?: string
}

type PlatformFieldGroupLike = {
  fields?: PlatformFieldLike[]
}

export function buildListingGaps({
  product,
  activeStore,
  draft,
  imageCount,
  minImages,
  requiredAttributes,
  filledAttributes,
  enabledSkuCount,
  skuReadyCount,
}: {
  product: ContentWorkbenchItem | null
  activeStore: string
  draft: Record<string, string>
  imageCount: number
  minImages: number
  requiredAttributes: string[]
  filledAttributes: number
  enabledSkuCount: number
  skuReadyCount: number
}): ListingGap[] {
  const gaps: ListingGap[] = []
  if (!product) {
    gaps.push({ id: 'product', label: '未选择商品', anchor: 'listing-master-copy', targetId: 'listing-field-title', severity: 'blocker' })
  }
  if (!activeStore) {
    gaps.push({ id: 'store', label: '未选择目标店铺', anchor: 'listing-master-logistics', targetId: 'listing-field-target-store', severity: 'blocker' })
  }
  if (imageCount < minImages) {
    gaps.push({ id: 'images', label: `图片不足 ${imageCount}/${minImages}`, anchor: 'listing-master-media', targetId: 'listing-field-images', severity: 'blocker' })
  }
  if (!draft.title?.trim()) {
    gaps.push({ id: 'title', label: '商品标题待填写', anchor: 'listing-master-copy', targetId: 'listing-field-title', severity: 'blocker' })
  }
  if (!draft.description?.trim()) {
    gaps.push({ id: 'description', label: '商品描述待填写', anchor: 'listing-master-copy', targetId: 'listing-field-description', severity: 'blocker' })
  }
  if (!draft.category?.trim()) {
    gaps.push({ id: 'category', label: '商品类目待确认', anchor: 'listing-master-attributes', targetId: 'listing-field-category', severity: 'blocker' })
  }
  if (requiredAttributes.length === 0) {
    gaps.push({ id: 'schema', label: '平台字段组待加载', anchor: 'listing-master-attributes', targetId: 'listing-platform-field-group', severity: 'warning' })
  } else if (filledAttributes < requiredAttributes.length) {
    gaps.push({ id: 'attributes', label: `平台属性待补 ${filledAttributes}/${requiredAttributes.length}`, anchor: 'listing-master-attributes', targetId: 'listing-platform-field-group', severity: 'blocker' })
  }
  if (enabledSkuCount === 0) {
    gaps.push({ id: 'sku-enabled', label: 'SKU 变体未启用', anchor: 'listing-master-sku', targetId: 'listing-field-sku-table', severity: 'blocker' })
  } else if (skuReadyCount < enabledSkuCount) {
    gaps.push({ id: 'sku-ready', label: `SKU 销售资料待补 ${skuReadyCount}/${enabledSkuCount}`, anchor: 'listing-master-sku', targetId: 'listing-field-sku-table', severity: 'blocker' })
  }
  if (!draft.price?.trim()) {
    gaps.push({ id: 'price', label: '基础售价待填写', anchor: 'listing-master-sku', targetId: 'listing-field-sku-price', severity: 'blocker' })
  }
  if (!draft.weight?.trim() || !draft.packageSize?.trim()) {
    gaps.push({ id: 'package', label: '重量/包装尺寸待补', anchor: 'listing-master-logistics', targetId: draft.weight?.trim() ? 'listing-field-package-size' : 'listing-field-weight', severity: 'blocker' })
  }
  if (!draft.shipFrom?.trim() || !draft.leadTime?.trim()) {
    gaps.push({ id: 'shipping', label: '发货地/时效待补', anchor: 'listing-master-logistics', targetId: draft.shipFrom?.trim() ? 'listing-field-lead-time' : 'listing-field-ship-from', severity: 'warning' })
  }
  if (!draft.compliance?.trim() || !draft.certificate?.trim()) {
    gaps.push({ id: 'compliance', label: '合规/认证待复核', anchor: 'listing-master-logistics', targetId: draft.compliance?.trim() ? 'listing-field-certificate' : 'listing-field-compliance', severity: 'warning' })
  }
  return gaps
}

export function buildTaskPayloads(
  draft: Record<string, string>,
  product: ContentWorkbenchItem,
  activeStore: string,
  skuRows: SellerSkuRow[],
  imageSlots: ListingImageSlot[],
  platformRequirements?: PlatformRequirementsLike,
) {
  const sellingPoints = getSellingPoints(draft)
  const attributeSummary = Object.entries(mergePlatformAttributeValues(draft, platformRequirements))
    .map(([label, value]) => `${label}: ${value || '待补'}`)
    .join('\n')
  const skuSummary = skuRows.map(row => [
    `规格一: ${row.optionOne || '默认款'}`,
    `规格二: ${row.optionTwo || '未设置'}`,
    `商家SKU: ${row.merchantSku || '待生成'}`,
    `平台SKU: ${row.platformSku || '发布后回写'}`,
    `SKU图: ${row.skuImageRole || '待关联'}`,
    `售价: ${row.price || '待定价'}`,
    `库存: ${row.stock || '待同步/待填'}`,
    `重量: ${row.weight || '待补'}`,
    `包装尺寸: ${row.dimensions || '待补'}`,
    `状态: ${row.enabled ? '启用' : '停用'}`,
  ].join(' / ')).join('\n')
  const logisticsSummary = [
    `包裹重量: ${draft.weight || '待补'}`,
    `包装长宽高: ${draft.packageSize || '待补'}`,
    `发货地: ${draft.shipFrom || '待补'}`,
    `发货时效: ${draft.leadTime || '待补'}`,
  ].join('\n')
  return [
    {
      taskType: 'listing_copy',
      provider: 'manual_listing_master',
      content: draft.title.trim(),
    },
    {
      taskType: 'selling_points',
      provider: 'manual_listing_master',
      content: sellingPoints.join('\n') || draft.description.trim(),
    },
    {
      taskType: 'description',
      provider: 'manual_listing_master',
      content: draft.description.trim(),
    },
    {
      taskType: 'image_understanding',
      provider: 'manual_listing_master',
      content: `当前商品图片 ${product.media_readiness?.captured_image_count ?? (product.image_url ? 1 : 0)}/${product.media_readiness?.recommended_platform_images ?? 9}；主图来自真实商品图，缺口以媒体就绪度为准。`,
    },
    {
      taskType: 'image_edit_plan',
      provider: 'manual_listing_master',
      content: [
        '主图/辅图处理计划：保留真实商品主体，按目标平台补齐主图、场景图、尺寸图、细节图和 SKU 图；水印模板在图片/水印模板页单独配置。',
        `当前发布槽位：${imageSlots.map((slot, index) => `${index + 1}.${slot.label}:${slot.imageUrl ? '有图' : '待补'}`).join(' / ')}`,
      ].join('\n'),
    },
    {
      taskType: 'compliance_check',
      provider: 'manual_listing_master',
      content: [
        `目标店铺: ${activeStore || '未选择店铺'}`,
        attributeSummary,
        skuSummary,
        logisticsSummary,
        `禁限售复核: ${draft.compliance || '待复核'}`,
        `品牌/认证材料: ${draft.certificate || '待补'}`,
      ].filter(Boolean).join('\n'),
    },
  ]
}

export function buildImageSlots(sourceImage: string, minImages: number, recommendedImages: number): ListingImageSlot[] {
  return relabelImageSlots(Array.from({ length: recommendedImages }).map((_, index) => ({
    id: `image-slot-${index}`,
    label: '',
    role: '',
    imageUrl: index === 0 ? sourceImage : '',
    required: index < minImages,
  })), minImages)
}

export function relabelImageSlots(slots: ListingImageSlot[], minImages: number): ListingImageSlot[] {
  return slots.map((slot, index) => ({
    ...slot,
    id: slot.id || `image-slot-${index}`,
    label: imageSlotRole(index).label,
    role: imageSlotRole(index).role,
    required: index < minImages,
  }))
}

function imageSlotRole(index: number) {
  const roles = [
    ['主图', '搜索页首图 / 商品页主图'],
    ['场景辅图', '使用场景与佩戴/摆放效果'],
    ['尺寸图', '尺寸、容量、规格说明'],
    ['细节图', '材质、结构、做工细节'],
    ['SKU图', '颜色/规格变体图'],
    ['详情图', '包装、配件、卖点补充'],
  ]
  const role = roles[index] || [`辅图 ${index}`, '补充场景 / 对比 / 细节素材']
  return { label: role[0], role: role[1] }
}

export function defaultSkuRow(merchantSku: string, price: string): SellerSkuRow {
  return {
    id: 'default',
    optionOne: '默认款',
    optionTwo: '',
    merchantSku,
    platformSku: '',
    skuImageRole: '主图',
    price,
    stock: '',
    weight: '',
    dimensions: '',
    enabled: true,
  }
}

export function mergePlatformAttributeValues(draft: Record<string, string>, platformRequirements?: PlatformRequirementsLike): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(platformRequirements?.attribute_values || {}) }
  const legacyAttributes = pickLegacyAttributes(draft)
  const aliasesByLegacyKey = platformAttributeAliases(platformRequirements)
  for (const [legacyKey, value] of Object.entries(legacyAttributes)) {
    if (!value) continue
    if (!hasAttributeValue(merged, legacyKey)) merged[legacyKey] = value
    for (const alias of aliasesByLegacyKey[legacyKey] || []) {
      if (!hasAttributeValue(merged, alias)) merged[alias] = value
    }
  }
  return merged
}

export function hasAttributeValue(values: Record<string, unknown>, field: string) {
  const value = values[field]
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function getSellingPoints(draft: Record<string, string>) {
  return (draft.description || '')
    .split(/\n+/)
    .map(line => line.replace(/^[-*•\d.、\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function pickLegacyAttributes(draft: Record<string, string>) {
  return Object.fromEntries(Object.entries({
    brand: draft.brand || '',
    material: draft.material || '',
    model: draft.model || '',
    audience: draft.audience || '',
    color: draft.color || '',
    size: draft.size || '',
    capacity: draft.capacity || '',
    style: draft.style || '',
  }).filter(([, value]) => value.trim()))
}

function platformAttributeAliases(platformRequirements?: PlatformRequirementsLike) {
  const aliases: Record<string, string[]> = {
    brand: ['brand', 'Brand', '品牌', '品牌/No Brand'],
    material: ['material', 'Material', '材质'],
    model: ['model', 'Model', '型号'],
    audience: ['audience', '适用人群', '适用对象'],
    color: ['color', 'Color', '颜色'],
    size: ['size', 'Size', '尺寸', '尺码'],
    capacity: ['capacity', '容量'],
    style: ['style', '风格', '款式'],
  }
  for (const field of platformFields(platformRequirements)) {
    const candidates = [
      field.key,
      field.label,
      field.unified_field_key,
      field.standard_label,
      field.platform_field_name,
      field.miaoshou_field_name,
    ].filter((item): item is string => Boolean(item && item.trim()))
    for (const [legacyKey, knownAliases] of Object.entries(aliases)) {
      if (candidates.some(candidate => knownAliases.includes(candidate))) {
        aliases[legacyKey] = Array.from(new Set([...knownAliases, ...candidates]))
      }
    }
  }
  for (const attr of platformRequirements?.required_attributes || []) {
    for (const [legacyKey, knownAliases] of Object.entries(aliases)) {
      if (knownAliases.includes(attr)) {
        aliases[legacyKey] = Array.from(new Set([...knownAliases, attr]))
      }
    }
  }
  return aliases
}

function platformFields(platformRequirements?: PlatformRequirementsLike): PlatformFieldLike[] {
  return (platformRequirements?.field_groups || [])
    .filter((group): group is PlatformFieldGroupLike => Boolean(group && typeof group === 'object'))
    .flatMap(group => Array.isArray(group.fields) ? group.fields : [])
    .filter((field): field is PlatformFieldLike => Boolean(field && typeof field === 'object'))
}
