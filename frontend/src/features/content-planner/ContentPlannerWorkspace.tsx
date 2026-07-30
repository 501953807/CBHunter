import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import type { ContentWorkbenchItem } from '../../api/content'
import { usePlatforms } from '../../hooks/usePlatforms'
import { ContentProductQueue } from './ContentProductQueue'
import { ProfessionalWorkspaceFrame } from '../../components/shared/ProfessionalWorkspaceFrame'
import { productImageSrc } from '../../utils/productImages'
import { ContentListingStageRail } from './ContentListingStageRail'
import { ContentMediaStudio } from './ContentMediaStudio'
import { SellerPlatformListingEditorPanel } from './SellerPlatformListingEditorPanel'
type ContentWorkspaceMode = 'queue' | 'listing' | 'image'
export default function ContentPlannerPage() {
  const navigate = useNavigate()
  const { tab } = useParams()
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('product_id') || ''
  const highlightPlatformFieldKey = searchParams.get('platform_field_key') || ''
  const initialListingAnchor = useMemo(
    () => listingSectionAnchor(searchParams.get('section') || searchParams.get('listing_section') || ''),
    [searchParams],
  )
  const initialImageSlotIndex = useMemo(
    () => parseListingImageSlot(searchParams.get('image_slot') || ''),
    [searchParams],
  )
  const { data: platformsData } = usePlatforms()
  const storeOptions = (platformsData?.data || []).map((account: any) => ({
    value: account.id,
    label: `${account.platform} · ${account.account_name}`,
  }))
  const [activeStore, setActiveStore] = useState('')
  const activeStoreLabel = storeOptions.find(store => store.value === activeStore)?.label || ''
  const [selectedProduct, setSelectedProduct] = useState<ContentWorkbenchItem | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<ContentWorkspaceMode>(() => {
    if (tab === 'image') return 'image'
    if (tab && tab !== 'queue') return 'listing'
    if (initialListingAnchor) return 'listing'
    return initialProductId ? 'listing' : 'queue'
  })
  const [activeImageSlotIndex, setActiveImageSlotIndex] = useState(initialImageSlotIndex)
  const refreshContentTasks = useCallback(() => setSelectedProduct(current => current ? { ...current } : current), [])
  const handleSelectProduct = useCallback((item: ContentWorkbenchItem) => {
    setSelectedProduct(item)
  }, [])

  const changeTab = (nextTab: string, options?: { imageSlotIndex?: number }) => {
    const imageSlotIndex = options?.imageSlotIndex ? normalizeListingImageSlot(options.imageSlotIndex) : activeImageSlotIndex
    const productQuery = selectedProduct ? `?product_id=${encodeURIComponent(selectedProduct.id)}` : ''
    const imageQuery = selectedProduct ? `?product_id=${encodeURIComponent(selectedProduct.id)}&image_slot=${imageSlotIndex}` : ''
    if (nextTab === 'media') setWorkspaceMode('image')
    if (nextTab !== 'media') setWorkspaceMode(nextTab === 'queue' ? 'queue' : 'listing')
    if (nextTab === 'media') setActiveImageSlotIndex(imageSlotIndex)
    const path = nextTab === 'queue'
      ? '/content'
      : nextTab === 'title'
        ? `/content/title${productQuery}`
        : nextTab === 'export'
          ? `/content/export${productQuery}`
          : nextTab === 'media'
            ? `/content/image${imageQuery}`
            : `/content/title${productQuery}`
    navigate(path)
  }
  const openListing = useCallback((item: ContentWorkbenchItem) => {
    handleSelectProduct(item)
    setWorkspaceMode('listing')
    navigate(`/content/title?product_id=${encodeURIComponent(item.id)}`)
  }, [handleSelectProduct, navigate])
  const openImageEditor = useCallback((item: ContentWorkbenchItem, imageSlotIndex = 1) => {
    const normalizedSlotIndex = normalizeListingImageSlot(imageSlotIndex)
    handleSelectProduct(item)
    setWorkspaceMode('image')
    setActiveImageSlotIndex(normalizedSlotIndex)
    navigate(`/content/image?product_id=${encodeURIComponent(item.id)}&image_slot=${normalizedSlotIndex}`)
  }, [handleSelectProduct, navigate])
  const backToQueue = () => {
    setWorkspaceMode('queue')
    navigate('/content')
  }
  const jumpToListingSection = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    if (!initialListingAnchor || workspaceMode !== 'listing' || !selectedProduct) return
    window.setTimeout(() => {
      document.getElementById(initialListingAnchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }, [initialListingAnchor, selectedProduct, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== 'image') return
    setActiveImageSlotIndex(initialImageSlotIndex)
  }, [initialImageSlotIndex, workspaceMode])

  return (
    <div className="space-y-6">
      <ContentListingStageRail />
      <ProfessionalWorkspaceFrame
        eyebrow="Content Operations"
        title="内容制作"
        density="compact"
        actions={
          <div data-ui="content-listing-compact-toolbar" className="flex min-w-[520px] flex-wrap items-center justify-end gap-2">
            <span className="max-w-[220px] truncate rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-muted)]">
              {selectedProduct ? selectedProduct.product_name : '未选择商品'}
            </span>
            <div className="w-64">
              <Select
                options={storeOptions}
                value={activeStore}
                onChange={setActiveStore}
                placeholder="选择已绑定店铺"
              />
            </div>
          </div>
        }
      />

      <section aria-label="内容工厂待制作产品列表" data-ui="content-factory-product-queue-page" className="min-h-[calc(100vh-190px)] space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-md)]">
        <div data-ui="content-queue-command-toolbar" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 一体化内容工作台</p>
            <p className="text-sm font-semibold text-[var(--color-fg)]">待制作商品列表</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">先从商品队列选择对象，再打开 Listing 详情处理标题、描述、图片、SKU 和平台字段。列表始终保留为主页面，详情以覆盖式工作台打开。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled>批量生成文案</Button>
            <Button variant="outline" disabled>批量校验素材</Button>
            <Button variant="secondary" disabled>推送到定价队列</Button>
          </div>
        </div>
        <ContentProductQueue
          onSelect={handleSelectProduct}
          onOpenListing={openListing}
          onOpenMediaWorkbench={openImageEditor}
          initialProductId={initialProductId}
          layout="table"
          autoSelect={Boolean(initialProductId)}
        />
      </section>

      {workspaceMode === 'listing' && (
        <ContentEditorOverlay title="单商品 Listing 详情编辑" onClose={backToQueue}>
          <section aria-label="单商品 Listing 详情编辑工作区" data-ui="content-listing-detail-overlay-workspace" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={backToQueue}>
                <ArrowLeft className="mr-1 h-4 w-4" />返回待制作产品列表
              </Button>
              <Button variant="secondary" onClick={() => selectedProduct && openImageEditor(selectedProduct, 1)} disabled={!selectedProduct}>
                处理商品图片
              </Button>
            </div>
            <SellerPlatformListingEditorPanel
              product={selectedProduct}
              activeStore={activeStoreLabel}
              changeTab={changeTab}
              onSaved={refreshContentTasks}
              highlightPlatformFieldKey={highlightPlatformFieldKey}
            />
          </section>
        </ContentEditorOverlay>
      )}

      {workspaceMode === 'image' && (
        <ContentEditorOverlay title="商品图片专用编辑" onClose={backToQueue}>
          <section aria-label="当前商品主图编辑工作区" data-ui="content-image-edit-overlay-workspace" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={backToQueue}>
                <ArrowLeft className="mr-1 h-4 w-4" />返回待制作产品列表
              </Button>
              <Button variant="secondary" onClick={() => selectedProduct && openListing(selectedProduct)} disabled={!selectedProduct}>
                <ArrowRight className="mr-1 h-4 w-4" />回到 Listing 详情
              </Button>
            </div>
            <CurrentListingHeader product={selectedProduct} onGapClick={jumpToListingSection} />
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-4">
                <p className="text-xs font-semibold text-[var(--color-primary)]">图片专用编辑工作台</p>
                <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">主图、辅图、SKU 图、尺寸图、场景图集中处理</h3>
                <p className="mt-1 text-xs text-[var(--color-muted)]">图片处理独立于 Listing 字段编辑，支持拖拽排序、新增图片空位和槽位计划保存。</p>
              </div>
              <ContentMediaStudio mode="image" product={selectedProduct} initialSlotIndex={activeImageSlotIndex} />
            </section>
          </section>
        </ContentEditorOverlay>
      )}
    </div>
  )
}

function listingSectionAnchor(section: string) {
  const normalized = section.trim().toLowerCase()
  const anchors: Record<string, string> = {
    sku: 'listing-master-sku',
    specs: 'listing-master-sku',
    specification: 'listing-master-sku',
    attributes: 'listing-master-attributes',
    platform_fields: 'listing-master-attributes',
    media: 'listing-master-media',
    images: 'listing-master-media',
    copy: 'listing-master-copy',
    title: 'listing-master-copy',
    logistics: 'listing-master-logistics',
    compliance: 'listing-master-logistics',
  }
  return anchors[normalized] || ''
}

function parseListingImageSlot(slot: string) {
  return normalizeListingImageSlot(Number(slot))
}

function normalizeListingImageSlot(slot: number) {
  if (!Number.isFinite(slot)) return 1
  return Math.max(1, Math.min(99, Math.floor(slot)))
}

function ContentEditorOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-overlay)] p-3 backdrop-blur-sm md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-ui="content-factory-editor-overlay"
    >
      <div className="mx-auto flex h-full max-w-[1760px] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">内容工厂覆盖式工作台</p>
            <h2 className="text-base font-semibold text-[var(--color-fg)]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            aria-label="关闭编辑工作台"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

function CurrentListingHeader({ product, onGapClick }: { product: ContentWorkbenchItem | null; onGapClick: (sectionId: string) => void }) {
  const media = product?.media_readiness
  const requirements = product?.platform_requirements
  const requiredAttributes = requirements?.required_attributes || []
  const attributeValues = requirements?.attribute_values || {}
  const filledAttributes = requiredAttributes.filter(field => hasAttributeValue(attributeValues, field)).length
  const imageCount = media?.captured_image_count ?? 0
  const minImages = media?.min_platform_images ?? 5
  const recommendedImages = media?.recommended_platform_images ?? 9
  const mediaPct = minImages > 0 ? Math.min(100, Math.round((imageCount / minImages) * 100)) : 0
  const attrPct = requiredAttributes.length ? Math.round((filledAttributes / requiredAttributes.length) * 100) : 0
  const contentReady = product?.content_status === 'ready'
  const contentPct = contentReady ? 100 : product?.content_status === 'in_progress' ? 55 : product ? 18 : 0
  const readinessItems = [
    { label: '内容任务', value: product ? product.content_status === 'ready' ? '可进入定价' : product.content_status === 'in_progress' ? '制作中' : '未开始' : '未选择', pct: contentPct, tone: contentReady ? 'success' : 'warning' },
    { label: '图片素材', value: product ? `${imageCount}/${minImages} 张` : '未选择', pct: mediaPct, tone: imageCount >= minImages ? 'success' : 'warning' },
    { label: '平台属性', value: product ? `${filledAttributes}/${requiredAttributes.length || 0}` : '未选择', pct: attrPct, tone: requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length ? 'success' : 'warning' },
  ]
  const previewImages = product?.image_url ? [product.image_url] : []
  const priceText = product?.selling_price_local != null ? `${product.selling_price_local}` : '待定价'
  const sourcePriceText = product?.source_price_rmb != null ? `¥${product.source_price_rmb}` : '采购价待补'
  const profitText = product?.profit_margin_pct != null ? `${product.profit_margin_pct}%` : '利润待校验'
  const gaps = [
    ...(product?.content_gaps || []).map(label => ({ label, target: gapTarget(label) })),
    ...(media?.gaps || []).map(label => ({ label, target: 'listing-master-media' })),
    ...requiredAttributes.filter(field => !hasAttributeValue(attributeValues, field)).slice(0, 4).map(field => ({ label: `缺属性：${field}`, target: 'listing-master-attributes' })),
  ]
  return (
    <section aria-label="当前商品 Listing 对象总览" className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
      <div className="grid gap-0 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-3 xl:border-b-0 xl:border-r">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
            {product?.image_url ? (
              <img src={productImageSrc(product.image_url)} alt={product.product_name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="grid aspect-square place-items-center text-xs text-[var(--color-muted)]">未选择商品</div>
            )}
            <div className="absolute bottom-2 left-2 rounded-full bg-[var(--color-surface)]/95 px-2 py-1 text-[11px] text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
              主图 {imageCount}/{recommendedImages}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid aspect-square place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] text-[var(--color-muted)]">
                {previewImages[index] ? <img src={productImageSrc(previewImages[index])} alt={`商品图 ${index + 1}`} className="h-full w-full rounded-lg object-cover" /> : index === 0 ? '主图' : `辅${index}`}
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-primary)]">当前编辑商品</p>
              <h2 className="mt-1 line-clamp-2 text-2xl font-bold tracking-tight text-[var(--color-fg)]">{product?.product_name || '请先从左侧选择待制作商品'}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {product ? `${product.target_platform || '平台待补'} / ${product.target_market || '市场待补'} · ${product.category || '类目待补'} · ${product.lifecycle_label}` : '选择商品后，标题、图片、视频、平台字段和下游定价发布都围绕同一个对象处理。'}
              </p>
            </div>
            <Badge variant={contentReady ? 'success' : product ? 'warning' : 'default'}>{product ? product.next_action || product.content_status : '未锁定商品'}</Badge>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {readinessItems.map(item => <ListingReadinessMeter key={item.label} {...item} />)}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.35fr]">
            <ListingFact label="价格链路" value={`售价 ${priceText}`} detail={`采购 ${sourcePriceText} · ${profitText}`} warning={product?.selling_price_local == null || product?.profit_margin_pct == null} />
            <ListingFact label="平台字段" value={`${filledAttributes}/${requiredAttributes.length || 0} 已填`} detail={(requirements?.evidence_source || '字段组待平台/类目补齐') as string} warning={requiredAttributes.length === 0 || filledAttributes < requiredAttributes.length} />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-[11px] text-[var(--color-muted)]">当前缺口</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {gaps.slice(0, 5).map(gap => (
                  <button
                    key={gap.label}
                    type="button"
                    data-ui="listing-gap-jump-chip"
                    onClick={() => onGapClick(gap.target)}
                    className="rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)] transition hover:bg-[var(--color-surface)] hover:shadow-[var(--shadow-sm)]"
                  >
                    {gap.label}
                  </button>
                ))}
                {gaps.length === 0 && <span className="rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]">暂无阻断缺口</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function gapTarget(label: string) {
  if (/图|图片|素材|视频|media/i.test(label)) return 'listing-master-media'
  if (/SKU|变体|规格/i.test(label)) return 'listing-master-sku'
  if (/属性|类目|品牌|材质|型号|颜色|尺寸|容量|风格/i.test(label)) return 'listing-master-attributes'
  if (/物流|合规|重量|包装|发货|认证/i.test(label)) return 'listing-master-logistics'
  return 'listing-master-copy'
}

function ListingReadinessMeter({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  const color = tone === 'success' ? 'var(--color-success)' : 'var(--color-warning)'
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-muted)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--color-fg)]">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

function ListingFact({ label, value, detail, warning }: { label: string; value: string; detail: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function hasAttributeValue(values: Record<string, unknown>, field: string) {
  const value = values[field]
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}
