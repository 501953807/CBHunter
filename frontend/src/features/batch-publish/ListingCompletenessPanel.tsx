import { Badge } from '../../components/ui/Badge'
import type { BatchListingDraft } from '../../api/listing'

interface CompletenessItem {
  label: string
  status: 'ready' | 'missing' | 'optional' | 'warning'
  detail: string
}

interface FunnelItem {
  label: string
  status: 'ready' | 'missing'
  detail: string
}

export function ListingCompletenessPanel({ draft }: { draft: BatchListingDraft }) {
  const items = buildCompletenessItems(draft)
  const funnel = buildFunnelItems(draft)
  const readyCount = items.filter(item => item.status === 'ready').length
  const requiredCount = items.filter(item => item.status !== 'optional').length

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5" aria-label="Listing 完整度">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">Listing 完整度</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">按商品详情页对象检查，不把 Listing 简化成标题和价格。</p>
        </div>
        <Badge variant={readyCount >= requiredCount ? 'success' : 'warning'}>
          {readyCount}/{requiredCount}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5" aria-label="Listing 曝光点击转化检查">
        {funnel.map(item => (
          <div key={item.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold text-[var(--color-fg)]">{item.label}</span>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: item.status === 'ready' ? 'var(--color-success)' : 'var(--color-warning)' }}
              />
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--color-muted)]" title={item.detail}>{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map(item => (
          <div key={item.label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-medium text-[var(--color-fg)]">{item.label}</span>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: item.status === 'ready'
                    ? 'var(--color-success)'
                    : item.status === 'optional'
                      ? 'var(--color-muted)'
                      : 'var(--color-warning)',
                }}
              />
            </div>
            <p className="mt-0.5 truncate text-[10px] text-[var(--color-muted)]" title={item.detail}>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function buildCompletenessItems(draft: BatchListingDraft): CompletenessItem[] {
  const attributeValues = draft.platform_requirements?.attribute_values || {}
  const images = draft.media_assets?.images || (Array.isArray(draft.images) ? draft.images : draft.images ? [draft.images] : [])
  const mediaReadiness = draft.media_assets?.media_readiness
  const minImages = mediaReadiness?.min_platform_images ?? 5
  const missingImages = mediaReadiness?.missing_image_count ?? Math.max(minImages - images.length, 0)
  const mediaGaps = mediaReadiness?.gaps || []
  const variants = draft.sku_plan?.variants || []
  const videos = draft.media_assets?.videos || []
  return [
    {
      label: '分类节点',
      status: draft.category ? 'ready' : 'missing',
      detail: draft.category || '待补平台类目/分类节点',
    },
    {
      label: '搜索关键词',
      status: hasAny(attributeValues, ['search_keywords', 'keywords', 'search_terms']) ? 'ready' : 'missing',
      detail: textFromAny(attributeValues, ['search_keywords', 'keywords', 'search_terms']) || '待补搜索词/关键词',
    },
    {
      label: '图片',
      status: images.length && !missingImages ? 'ready' : images.length ? 'warning' : 'missing',
      detail: images.length
        ? `${images.length} 张图片；平台至少 ${minImages} 张${mediaGaps.length ? `，缺：${mediaGaps.join('、')}` : ''}`
        : '待补真实商品图',
    },
    {
      label: '标题',
      status: draft.template_title?.trim() ? 'ready' : 'missing',
      detail: draft.template_title || '待补商品标题',
    },
    {
      label: '商品要点',
      status: hasAny(attributeValues, ['bullet_points', 'selling_points', 'highlights']) || draft.template_description?.trim() ? 'ready' : 'missing',
      detail: textFromAny(attributeValues, ['bullet_points', 'selling_points', 'highlights']) || (draft.template_description ? '已由描述承接卖点' : '待补核心卖点'),
    },
    {
      label: '商品描述',
      status: draft.template_description?.trim() ? 'ready' : 'missing',
      detail: draft.template_description ? '已维护描述' : '待补商品描述',
    },
    {
      label: '价格/配送',
      status: draft.selling_price && draft.logistics?.weight_g ? 'ready' : 'missing',
      detail: draft.selling_price ? (draft.logistics?.weight_g ? '售价与履约基础已维护' : '待补重量/配送基础') : '待补售价',
    },
    {
      label: '变体/SKU',
      status: draft.sku_plan?.master_sku || variants.length ? 'ready' : 'missing',
      detail: variants.length ? `${variants.length} 个变体` : draft.sku_plan?.master_sku ? '已维护主 SKU' : '待补 SKU/规格',
    },
    {
      label: 'A+/高级内容',
      status: hasAny(attributeValues, ['aplus_content', 'enhanced_content', 'rich_content']) ? 'ready' : 'optional',
      detail: textFromAny(attributeValues, ['aplus_content', 'enhanced_content', 'rich_content']) || '可选增强内容',
    },
    {
      label: '品牌名称',
      status: hasAny(attributeValues, ['brand', 'brand_name']) ? 'ready' : 'missing',
      detail: textFromAny(attributeValues, ['brand', 'brand_name']) || '待补品牌或通用品牌声明',
    },
    {
      label: '短视频',
      status: videos.length ? 'ready' : 'optional',
      detail: videos.length ? `${videos.length} 条视频` : '可选但建议补充',
    },
  ]
}

function buildFunnelItems(draft: BatchListingDraft): FunnelItem[] {
  const attributeValues = draft.platform_requirements?.attribute_values || {}
  const images = draft.media_assets?.images || (Array.isArray(draft.images) ? draft.images : draft.images ? [draft.images] : [])
  const variants = draft.sku_plan?.variants || []
  const hasSearchTerms = hasAny(attributeValues, ['search_keywords', 'keywords', 'search_terms'])
  const hasTitle = Boolean(draft.template_title?.trim())
  const hasDescription = Boolean(draft.template_description?.trim())
  const hasBullets = hasAny(attributeValues, ['bullet_points', 'selling_points', 'highlights'])
  const hasAttributes = Object.keys(attributeValues).length > 0
  return [
    {
      label: '曝光',
      status: draft.category && hasSearchTerms && hasTitle ? 'ready' : 'missing',
      detail: '依赖标题、类目、关键词、属性，让平台知道商品是什么。',
    },
    {
      label: '点击',
      status: hasTitle && images.length > 0 && Boolean(draft.selling_price) ? 'ready' : 'missing',
      detail: '搜索页核心是主图、标题、价格、评分；当前先检查前三项。',
    },
    {
      label: '转化',
      status: hasDescription && (hasBullets || hasAttributes) && (draft.sku_plan?.master_sku || variants.length) ? 'ready' : 'missing',
      detail: '详情页用要点、描述、参数、变体、视频和评价解除购买顾虑。',
    },
  ]
}

function hasAny(values: Record<string, unknown>, keys: string[]) {
  return keys.some(key => {
    const value = values[key]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  })
}

function textFromAny(values: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = values[key]
    if (Array.isArray(value)) return value.join('、')
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}
