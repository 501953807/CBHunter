import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, GripVertical, ImagePlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { confirmContentTaskVersion, saveContentTaskVersion, type ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'
import { useToast } from '../../components/ui/Toast'
import { logger } from '../../utils/logger'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { ListingCriticalActionStrip } from './ListingCriticalActionStrip'
import { ListingCopyAiAssistPanel } from './ListingCopyAiAssistPanel'
import {
  buildImageSlots,
  buildListingGaps,
  buildTaskPayloads,
  defaultSkuRow,
  hasAttributeValue,
  mergePlatformAttributeValues,
  relabelImageSlots,
  type ListingGap,
  type ListingImageSlot,
  type SellerSkuRow,
} from './SellerPlatformListingEditorUtils'

export function SellerPlatformListingEditorPanel({ product, activeStore, changeTab, onSaved, highlightPlatformFieldKey = '' }: {
  product: ContentWorkbenchItem | null
  activeStore: string
  changeTab: (nextTab: string, options?: { imageSlotIndex?: number }) => void
  onSaved?: () => Promise<void> | void
  highlightPlatformFieldKey?: string
}) {
  const toast = useToast()
  const [activeAnchor, setActiveAnchor] = useState('listing-master-media')
  const [activeGap, setActiveGap] = useState<ListingGap | null>(null)
  const title = product?.content_brief?.title || product?.product_name || ''
  const sourceBullets = product?.content_brief?.bullets || []
  const sourceBulletsKey = sourceBullets.join('\n')
  const description = sourceBullets.join('\n') || ''
  const minImages = product?.media_readiness?.min_platform_images ?? 5
  const recommendedImages = product?.media_readiness?.recommended_platform_images ?? 9
  const sourcePlatformRequirements = product?.platform_requirements as PlatformRequirementsLike | undefined
  const sourceAttributeValues = sourcePlatformRequirements?.attribute_values || {}
  const anchors = [
    ['listing-master-media', '图片素材'],
    ['listing-master-copy', '标题/描述'],
    ['listing-master-attributes', '类目属性'],
    ['listing-master-sku', 'SKU/销售'],
    ['listing-master-logistics', '物流/合规'],
  ]
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [skuRows, setSkuRows] = useState<SellerSkuRow[]>([])
  const [imageSlots, setImageSlots] = useState<ListingImageSlot[]>([])
  const [draggingImageIndex, setDraggingImageIndex] = useState<number | null>(null)
  const [platformRequirementsDraft, setPlatformRequirementsDraft] = useState<PlatformRequirementsLike | undefined>(sourcePlatformRequirements)
  const [skuBatchDraft, setSkuBatchDraft] = useState({ price: '', stock: '', weight: '', dimensions: '' })
  const [lastSkuBatchSummary, setLastSkuBatchSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const effectivePlatformRequirements = platformRequirementsDraft || sourcePlatformRequirements
  const highlightedFieldKey = highlightPlatformFieldKey ? decodeURIComponent(highlightPlatformFieldKey) : ''
  const requiredAttributes = effectivePlatformRequirements?.required_attributes || []
  const mergedAttributeValues = mergePlatformAttributeValues(draft, effectivePlatformRequirements)
  const filledAttributes = requiredAttributes.filter(field => hasAttributeValue(mergedAttributeValues, field)).length
  const enabledSkuCount = skuRows.filter(row => row.enabled).length
  const skuReadyCount = skuRows.filter(row => row.enabled && row.merchantSku.trim() && row.price.trim() && row.stock.trim()).length
  const publishableSlotImageCount = imageSlots.slice(0, recommendedImages).filter(slot => Boolean(slot.imageUrl)).length
  const confirmedSlotCount = product?.confirmed_image_slot_plan?.image_slots?.length || 0
  const confirmedPublishableCount = product?.confirmed_image_slot_plan?.publishable_image_count || 0
  const confirmedRetainedCount = product?.confirmed_image_slot_plan?.retained_image_count || 0
  const listingImageCount = publishableSlotImageCount
  const listingGaps = buildListingGaps({
    product,
    activeStore,
    draft,
    imageCount: listingImageCount,
    minImages,
    requiredAttributes,
    filledAttributes,
    enabledSkuCount,
    skuReadyCount,
  })
  const readinessSnapshot = [['发布图', `${listingImageCount}/${minImages}`, listingImageCount >= minImages], ['属性', `${filledAttributes}/${requiredAttributes.length || 0}`, requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length], ['SKU', `${skuReadyCount}/${enabledSkuCount || 0}`, enabledSkuCount > 0 && skuReadyCount >= enabledSkuCount], ['店铺', activeStore || '待选择', Boolean(activeStore)]]

  useEffect(() => {
    setDraft({
      title,
      description,
      category: product?.category || '',
      brand: String(sourceAttributeValues['品牌/No Brand'] || sourceAttributeValues.brand || sourceAttributeValues.Brand || 'No Brand'),
      material: String(sourceAttributeValues['材质'] || sourceAttributeValues.material || ''),
      model: String(sourceAttributeValues['型号'] || sourceAttributeValues.model || ''),
      audience: String(sourceAttributeValues['适用人群'] || ''),
      color: String(sourceAttributeValues['颜色'] || sourceAttributeValues.color || ''),
      size: String(sourceAttributeValues['尺寸'] || sourceAttributeValues.size || ''),
      capacity: String(sourceAttributeValues['容量'] || ''),
      style: String(sourceAttributeValues['风格'] || ''),
      sku: product?.id?.slice(0, 8) || '',
      price: product?.selling_price_local != null ? String(product.selling_price_local) : '',
      stock: '',
      weight: '',
      packageSize: '',
      shipFrom: '',
      leadTime: '',
      compliance: '',
      certificate: '',
    })
    setSkuRows([defaultSkuRow(product?.id?.slice(0, 8) || '', product?.selling_price_local != null ? String(product.selling_price_local) : '')])
    setImageSlots(buildImageSlots(product?.image_url || '', minImages, recommendedImages, product?.confirmed_image_slot_plan?.image_slots))
    setPlatformRequirementsDraft(sourcePlatformRequirements)
  }, [product?.id, title, description, product?.category, product?.selling_price_local, sourcePlatformRequirements, sourceAttributeValues, sourceBulletsKey, minImages, recommendedImages, product?.confirmed_image_slot_plan?.image_slots])

  useEffect(() => {
    if (!highlightedFieldKey) return
    setActiveAnchor('listing-master-attributes')
    setActiveGap({
      id: 'platform-field',
      label: `平台字段 ${highlightedFieldKey}`,
      anchor: 'listing-master-attributes',
      targetId: 'listing-platform-field-group',
      severity: 'warning',
    })
    window.setTimeout(() => {
      document.getElementById('listing-master-attributes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }, [highlightedFieldKey])

  useEffect(() => {
    if (!activeGap || activeGap.id === 'platform-field') return
    if (!listingGaps.some(gap => gap.id === activeGap.id)) setActiveGap(null)
  }, [activeGap, listingGaps])

  const updateDraft = (field: string, value: string) => setDraft(current => ({ ...current, [field]: value }))
  const updateSkuRow = (rowId: string, field: keyof SellerSkuRow, value: string | boolean) => {
    setSkuRows(current => current.map(row => row.id === rowId ? { ...row, [field]: value } : row))
  }
  const addSkuRow = () => {
    setSkuRows(current => [...current, {
      id: `sku-${Date.now()}`,
      optionOne: '',
      optionTwo: '',
      merchantSku: '',
      platformSku: '',
      skuImageRole: '',
      price: draft.price || '',
      stock: '',
      weight: draft.weight || '',
      dimensions: '',
      enabled: true,
    }])
  }
  const removeSkuRow = (rowId: string) => {
    setSkuRows(current => current.length <= 1 ? current : current.filter(row => row.id !== rowId))
  }
  const applySkuBatch = () => {
    const filledFields = [['price', '售价'], ['stock', '库存'], ['weight', '重量'], ['dimensions', '包装尺寸']].filter(([field]) => skuBatchDraft[field as keyof typeof skuBatchDraft]).map(([, label]) => label)
    setSkuRows(current => current.map(row => row.enabled ? {
      ...row,
      price: skuBatchDraft.price || row.price,
      stock: skuBatchDraft.stock || row.stock,
      weight: skuBatchDraft.weight || row.weight,
      dimensions: skuBatchDraft.dimensions || row.dimensions,
    } : row))
    setLastSkuBatchSummary(filledFields.length ? `本次写入：${filledFields.join('、')}` : '未填写批量字段，SKU保持原值')
    toast.addToast('success', '已把批量销售资料填充到启用 SKU')
  }
  const setMainImage = (slotIndex: number) => {
    setImageSlots(current => {
      if (slotIndex <= 0 || slotIndex >= current.length) return current
      const next = [...current]
      const [target] = next.splice(slotIndex, 1)
      next.unshift(target)
      return relabelImageSlots(next, minImages)
    })
  }
  const dropImageSlot = (targetIndex: number) => {
    setImageSlots(current => {
      if (draggingImageIndex === null || draggingImageIndex === targetIndex) return current
      if (draggingImageIndex < 0 || draggingImageIndex >= current.length || targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [dragged] = next.splice(draggingImageIndex, 1)
      next.splice(targetIndex, 0, dragged)
      return relabelImageSlots(next, minImages)
    })
    setDraggingImageIndex(null)
  }
  const addImageSlot = () => {
    setImageSlots(current => relabelImageSlots([
      ...current, { id: `image-slot-${Date.now()}`, label: '', role: '', imageUrl: '', required: false },
    ], minImages))
    toast.addToast('success', '已新增图片素材空位，可进入图片编辑页上传或处理图片')
  }
  const anchorLabel = (anchor: string) => anchors.find(([id]) => id === anchor)?.[1] || '对应编辑区'
  const targetLabel = (targetId?: string) => {
    const labels: Record<string, string> = {
      'listing-field-images': '图片槽位',
      'listing-field-title': '商品名称 / Listing 标题',
      'listing-field-description': '商品描述 / 图文详情',
      'listing-field-category': '商品类目',
      'listing-platform-field-group': '平台字段组',
      'listing-field-sku-table': 'SKU 销售资料主表',
      'listing-field-sku-price': 'SKU 售价',
      'listing-field-weight': '包裹重量',
      'listing-field-package-size': '包装长宽高',
      'listing-field-ship-from': '发货地',
      'listing-field-lead-time': '发货时效',
      'listing-field-compliance': '禁限售复核',
      'listing-field-certificate': '品牌/认证材料',
      'listing-field-target-store': '目标店铺',
    }
    return targetId ? labels[targetId] || '具体字段' : '具体字段'
  }
  const jump = (anchor: string, gap?: ListingGap) => {
    setActiveAnchor(anchor)
    setActiveGap(gap || null)
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (gap?.targetId) {
      window.setTimeout(() => {
        const target = document.getElementById(gap.targetId)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (target instanceof HTMLElement) target.focus({ preventScroll: true })
      }, 260)
    }
  }

  const resetDraft = () => {
    if (!product) return
    setDraft({
      title,
      description,
      category: product.category || '',
      brand: String(sourceAttributeValues['品牌/No Brand'] || sourceAttributeValues.brand || sourceAttributeValues.Brand || 'No Brand'),
      material: String(sourceAttributeValues['材质'] || sourceAttributeValues.material || ''),
      model: String(sourceAttributeValues['型号'] || sourceAttributeValues.model || ''),
      audience: String(sourceAttributeValues['适用人群'] || ''),
      color: String(sourceAttributeValues['颜色'] || sourceAttributeValues.color || ''),
      size: String(sourceAttributeValues['尺寸'] || sourceAttributeValues.size || ''),
      capacity: String(sourceAttributeValues['容量'] || ''),
      style: String(sourceAttributeValues['风格'] || ''),
      sku: product.id?.slice(0, 8) || '',
      price: product.selling_price_local != null ? String(product.selling_price_local) : '',
      stock: '',
      weight: '',
      packageSize: '',
      shipFrom: '',
      leadTime: '',
      compliance: '',
      certificate: '',
    })
    setSkuRows([defaultSkuRow(product.id?.slice(0, 8) || '', product.selling_price_local != null ? String(product.selling_price_local) : '')])
    setImageSlots(buildImageSlots(product.image_url || '', minImages, recommendedImages, product.confirmed_image_slot_plan?.image_slots))
    setPlatformRequirementsDraft(sourcePlatformRequirements)
  }

  const notifySaved = async () => {
    if (!onSaved) return
    try {
      await onSaved()
    } catch (error: any) {
      logger.error('Refresh content workbench after listing save failed', error)
      toast.addToast('warning', 'Listing 已保存，但当前商品上下文刷新失败，请重新打开该商品确认')
    }
  }

  const saveMaster = async () => {
    if (!product) return
    if (!draft.title?.trim()) {
      toast.addToast('error', '请先填写商品名称 / Listing 标题')
      jump('listing-master-copy')
      return
    }
    if (!draft.description?.trim()) {
      toast.addToast('error', '请先填写商品描述')
      jump('listing-master-copy')
      return
    }
    setSaving(true)
    try {
      const taskPayloads = buildTaskPayloads(draft, product, activeStore, skuRows, imageSlots, platformRequirementsDraft)
      for (const task of taskPayloads) {
        const saved = await saveContentTaskVersion(product.id, task.taskType, task.content, task.provider)
        const version = saved.data?.version
        if (version) await confirmContentTaskVersion(product.id, task.taskType, version)
      }
      await notifySaved()
      toast.addToast('success', '统一 Listing 母版已保存并确认')
    } catch (error: any) {
      logger.error('Save unified listing master failed', error)
      toast.addToast('error', error?.response?.data?.detail || '统一 Listing 母版保存失败')
    } finally {
      setSaving(false)
    }
  }

  const saveStoreOverride = async () => {
    if (!product) return
    if (!activeStore) {
      toast.addToast('error', '请先选择目标店铺，再保存店铺覆盖字段')
      return
    }
    setSaving(true)
    try {
      const saved = await saveContentTaskVersion(product.id, 'listing_store_override', JSON.stringify({
        schema: 'listing_store_override.v1',
        store_label: activeStore,
        title: draft.title || '',
        description: draft.description || '',
        sku: draft.sku || '',
        price: draft.price || '',
        stock: draft.stock || '',
        weight: draft.weight || '',
        package_size: draft.packageSize || '',
        ship_from: draft.shipFrom || '',
        lead_time: draft.leadTime || '',
        compliance: draft.compliance || '',
        certificate: draft.certificate || '',
        sku_rows: skuRows,
        image_slots: imageSlots,
        platform_attributes: mergePlatformAttributeValues(draft, platformRequirementsDraft),
        boundary: 'store_override_only',
      }, null, 2), 'manual_store_override')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'listing_store_override', version)
      await notifySaved()
      toast.addToast('success', '店铺 Listing 覆盖字段已保存')
    } catch (error: any) {
      logger.error('Save listing store override failed', error)
      toast.addToast('error', error?.response?.data?.detail || '店铺覆盖字段保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="统一 Listing 母版编辑器" data-ui="unified-listing-master-editor" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-primary)]">统一 Listing 母版</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">一次编辑，按店铺实例分发到 Shopee / TEMU / TikTok Shop</h3>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-[var(--color-muted)]">
              商品基础内容在母版维护；店铺、平台、市场差异通过覆盖字段保存。修改某个店铺 Listing 不会反向污染其他店铺或基础商品。
            </p>
          </div>
          <div id="listing-field-target-store" tabIndex={-1} className="flex flex-wrap gap-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
            <StatusPill ok={Boolean(product)} label={product ? '已锁定商品' : '未选择商品'} />
            <StatusPill ok={Boolean(activeStore)} label={activeStore || '目标店铺待选'} />
            <StatusPill ok={listingImageCount >= minImages} label={`发布图 ${listingImageCount}/${minImages}`} />
            <StatusPill ok={filledAttributes >= requiredAttributes.length && requiredAttributes.length > 0} label={`属性 ${filledAttributes}/${requiredAttributes.length || 0}`} />
          </div>
        </div>
        <div data-ui="seller-listing-product-context-strip" aria-label="当前商品 Listing 编辑对象上下文" className="mt-4 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-[88px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            {product?.image_url ? <img src={productImageSrc(product.image_url)} alt={product.product_name} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center text-[11px] text-[var(--color-muted)]">未选图</div>}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[var(--color-primary)]">当前商品对象：基础商品 → 平台 Listing → 店铺 Listing 覆盖</p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--color-fg)]">{product?.product_name || '请先从待制作列表选择商品'}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{product ? `${product.target_platform || '平台待补'} / ${product.target_market || '市场待补'} · ${product.category || '类目待补'} · 售价 ${product.selling_price_local ?? '待定价'}` : '选择商品后再编辑标题、图片、SKU、类目属性、物流和合规字段。'}</p>
              </div>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">修改只写当前母版/店铺覆盖，不污染其他店铺</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {readinessSnapshot.map(([label, value, ok]) => <StatusMetric key={String(label)} label={String(label)} value={String(value)} ok={Boolean(ok)} />)}
            </div>
          </div>
        </div>
        <nav aria-label="统一 Listing 母版字段快速定位" data-ui="unified-listing-sticky-field-nav" className="mt-4 flex gap-2 overflow-x-auto">
          {anchors.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => jump(id)}
              className={activeAnchor === id ? 'shrink-0 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]' : 'shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
            >
              {label}
            </button>
          ))}
        </nav>
        <div
          className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          data-ui="listing-gap-clickable-summary"
          aria-label="Listing 缺口点击定位摘要"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--color-fg)]">当前缺口定位</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">只展示会影响当前商品 Listing 保存、店铺覆盖或后续刊登的缺口；点击标签直接定位到对应编辑区。</p>
            </div>
            <span className={listingGaps.length ? 'rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-warning)]' : 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-success)]'}>
              {listingGaps.length ? `待补 ${listingGaps.length} 项` : '暂无阻断缺口'}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {listingGaps.length ? listingGaps.map(gap => (
              <button
                key={gap.id}
                type="button"
                onClick={() => jump(gap.anchor, gap)}
                className={gap.severity === 'blocker' ? 'rounded-full border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-warning)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]' : 'rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}
                data-ui="listing-gap-click-to-field"
              >
	                {gap.label}
	              </button>
	            )) : (
	              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-muted)]">图片、标题、属性、SKU、物流与合规已具备继续处理条件</span>
	            )}
	          </div>
	          <div
	            className="mt-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2 text-xs text-[var(--color-primary)]"
	            data-ui="listing-active-gap-context"
	            aria-label="当前定位的 Listing 缺口"
	          >
	            {activeGap ? (
              <span>正在处理：{activeGap.label}，已定位到「{anchorLabel(activeGap.anchor)} / {targetLabel(activeGap.targetId)}」。请在高亮编辑区内补齐字段后保存。</span>
	            ) : (
	              <span>当前定位：{anchorLabel(activeAnchor)}。点击上方缺口标签可直接跳到对应字段区域。</span>
	            )}
	          </div>
	        </div>
	        <ListingCriticalActionStrip product={product} activeStore={activeStore} listingGaps={listingGaps} jump={jump} changeTab={changeTab} />
	      </div>

	      <div className="space-y-5 p-5">
	        <EditorSection id="listing-master-media" title="商品图片与素材" description="顶部先处理商品图片。素材池可以保留多张，发布到平台时只取前 9 个槽位；槽位顺序决定平台主图和辅图顺序。" active={activeAnchor === 'listing-master-media'}>
          <div
            id="listing-field-images"
            tabIndex={-1}
            className="grid grid-cols-2 gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
            data-ui="listing-master-image-slot-grid"
          >
            {imageSlots.map((slot, index) => (
              <div
                key={slot.id}
                draggable
                onDragStart={() => setDraggingImageIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => dropImageSlot(index)}
                onDragEnd={() => setDraggingImageIndex(null)}
                className={draggingImageIndex === index ? 'overflow-hidden rounded-xl border border-[var(--color-primary)] bg-[var(--color-surface)] opacity-60 shadow-[var(--shadow-md)]' : 'overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'}
                data-ui="listing-image-slot-order-card"
              >
                <button
                  type="button"
                  onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
                  className="group relative block w-full bg-[var(--color-bg)]"
                  data-ui="listing-image-slot-edit-link"
                  aria-label={`编辑${slot.label}图片槽位`}
                >
                  {slot.imageUrl ? (
                    <img src={productImageSrc(slot.imageUrl)} alt={slot.label} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center gap-1 text-[11px] text-[var(--color-muted)]">
                      <ImagePlus className="h-5 w-5" />
                      <span>{slot.required ? '必填图' : '素材位'}</span>
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 bg-[var(--color-fg)]/70 px-1 py-1 text-[10px] text-[var(--color-surface)]">{slot.label}</span>
                  <span
                    className={index === 0 ? 'absolute left-1 top-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-surface)] shadow-[var(--shadow-sm)]' : 'absolute left-1 top-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-fg)] shadow-[var(--shadow-sm)]'}
                    data-ui="listing-image-slot-publish-order"
                  >
                    {index === 0 ? '主图' : `第${index + 1}张`}
                  </span>
                  <span
                    className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] shadow-[var(--shadow-sm)]"
                    data-ui="listing-image-slot-drag-handle"
                  >
                    <GripVertical className="h-3 w-3" />拖拽
                  </span>
                  <span className="absolute right-1 top-7 hidden rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-primary)] shadow-[var(--shadow-sm)] group-hover:block">编辑图片</span>
                </button>
                <div className="space-y-1 border-t border-[var(--color-border)] px-2 py-1">
                  <p className="truncate text-[10px] text-[var(--color-muted)]">{slot.role}</p>
                  <p
                    className={index < recommendedImages ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-muted)]'}
                    data-ui="listing-image-slot-publish-state"
                  >
                    {index === 0 ? '平台主图 / 搜索首图' : index < recommendedImages ? `发布前${recommendedImages}张内` : '素材池保留，不随本次发布'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1 border-t border-[var(--color-border)] p-1 text-[10px]">
                  <button type="button" onClick={() => setMainImage(index)} disabled={index === 0 || !slot.imageUrl} className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-primary)] disabled:opacity-30">设主图</button>
                  <button
                    type="button"
                    onClick={() => changeTab('media', { imageSlotIndex: index + 1 })}
                    className="rounded-md border border-[var(--color-border)] px-1 py-1 text-[var(--color-muted)]"
                    data-ui="listing-image-slot-edit-link"
                    aria-label={`编辑${slot.label}图片槽位`}
                  >
                    编辑
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addImageSlot}
              className="grid min-h-[132px] place-items-center rounded-xl border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-3 text-center text-xs text-[var(--color-primary)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
              data-ui="listing-master-add-image-slot"
            >
              <span>
                <ImagePlus className="mx-auto mb-2 h-6 w-6" />
                添加图片
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">素材可多于 9 张，发布取前 9 张</span>
              </span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]" data-ui="listing-image-operation-toolbar" aria-label="Listing 图片槽位操作规则">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">素材池 {imageSlots.length} 张，发布取前 {recommendedImages} 张</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">已排入发布 {publishableSlotImageCount}/{recommendedImages}</span>
            <span className={confirmedSlotCount ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 font-semibold text-[var(--color-success)]' : 'rounded-full border border-[var(--color-border)] px-2 py-1'} data-ui="listing-confirmed-image-slot-plan-summary">{confirmedSlotCount ? `已回显图片计划 ${confirmedPublishableCount || confirmedSlotCount} 张发布图${confirmedRetainedCount ? `，素材池 ${confirmedRetainedCount}` : ''}` : '未保存图片计划，使用源图初始化'}</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">至少 {minImages} 张</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">直接拖拽图片排序，首位即平台主图</span>
            <Button size="sm" variant="outline" onClick={() => changeTab('media', { imageSlotIndex: 1 })} disabled={!product}>打开第1张图片工作台</Button>
          </div>
        </EditorSection>

        <EditorSection id="listing-master-copy" title="商品标题与商品描述" description="这里只编辑平台买家能看到的核心文字内容；AI 辅助入口嵌在具体字段旁，候选写入后必须人工确认。" active={activeAnchor === 'listing-master-copy'}>
          <ListingCopyAiAssistPanel product={product} draft={draft} sourceBullets={sourceBullets} updateDraft={updateDraft} />
        </EditorSection>

        <EditorSection id="listing-master-attributes" title="类目属性" description="先按三平台字段组补齐类目属性，再维护系统统一共性字段。字段组来自商品当前平台要求，不再只展示少数固定属性。" active={activeAnchor === 'listing-master-attributes'}>
          <div className="space-y-4">
            <div
              className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              data-ui="seller-listing-platform-attribute-editor"
              id="listing-platform-field-group"
              tabIndex={-1}
              aria-label="卖家后台平台属性编辑区"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-fg)]">平台必填属性状态</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">字段来自目标平台/类目 Schema，缺口可直接在下方字段组和共性字段中补齐。</p>
                </div>
                <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                  已填写 {filledAttributes}/{requiredAttributes.length || 0}
                </span>
              </div>
              <table className="w-full min-w-[720px] text-left text-xs" aria-label="平台必填字段状态表">
                <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
                  <tr>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">平台字段</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">当前值</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">状态</th>
                    <th className="border-b border-[var(--color-border)] px-3 py-2">处理位置</th>
                  </tr>
                </thead>
                <tbody>
                  {(requiredAttributes.length ? requiredAttributes : ['品牌/No Brand', '材质', '型号', '颜色', '尺寸']).map(field => {
                    const lowerField = String(field).toLowerCase()
                    const value = mergedAttributeValues[field] || mergedAttributeValues[lowerField] || ''
                    const ready = hasAttributeValue(mergedAttributeValues, field) || hasAttributeValue(mergedAttributeValues, lowerField)
                    return (
                      <tr key={field}>
                        <td className="border-b border-[var(--color-border)] px-3 py-2 font-medium text-[var(--color-fg)]">{field}</td>
                        <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-muted)]">{String(value || '待填写')}</td>
                        <td className="border-b border-[var(--color-border)] px-3 py-2">
                          <span className={ready ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]' : 'rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[11px] text-[var(--color-warning)]'}>
                            {ready ? '已填写' : '待补'}
                          </span>
                        </td>
                        <td className="border-b border-[var(--color-border)] px-3 py-2 text-[var(--color-muted)]">字段组 / 共性字段</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PlatformFieldGroupEditor
              requirements={effectivePlatformRequirements}
              onChange={setPlatformRequirementsDraft}
              highlightedFieldKey={highlightedFieldKey}
            />
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">统一共性字段补充</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['category', '商品类目'],
              ['brand', requiredAttributes[0] || '品牌/No Brand'],
              ['material', requiredAttributes[1] || '材质'],
              ['model', requiredAttributes[2] || '型号'],
              ['audience', requiredAttributes[3] || '适用人群'],
              ['color', requiredAttributes[4] || '颜色'],
              ['size', requiredAttributes[5] || '尺寸'],
              ['capacity', requiredAttributes[6] || '容量'],
              ['style', requiredAttributes[7] || '风格'],
            ].map(([field, label]) => (
              <EditableInput key={field} fieldId={field === 'category' ? 'listing-field-category' : undefined} label={label} value={draft[field] || ''} onChange={value => updateDraft(field, value)} placeholder="待填写" />
            ))}
              </div>
            </div>
          </div>
        </EditorSection>

        <EditorSection id="listing-master-sku" title="SKU、销售资料与库存" description="按电商后台方式维护变体组合。每一行都是一个可发布 SKU，可单独编辑商家 SKU、平台 SKU、售价、库存、重量、包装尺寸和 SKU 图。" active={activeAnchor === 'listing-master-sku'}>
          <div
            className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            data-ui="seller-listing-sku-sales-editor"
            id="listing-field-sku-table"
            tabIndex={-1}
            aria-label="卖家后台 SKU 销售资料编辑区"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--color-fg)]">SKU 销售资料主表</p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">启用 SKU {enabledSkuCount} 条，销售资料完整 {skuReadyCount} 条；规格一/规格二可表达 Shopee/TikTok 常规变体，SPU/SKC 在平台 SKU 或平台扩展字段中保留。</p>
              </div>
              <Button size="sm" variant="outline" onClick={addSkuRow} disabled={!product}>新增 SKU 变体</Button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]" aria-label="SKU 批量操作工具条">
              <InlineInput value={skuBatchDraft.price} onChange={value => setSkuBatchDraft(current => ({ ...current, price: value }))} placeholder="批量售价" />
              <InlineInput value={skuBatchDraft.stock} onChange={value => setSkuBatchDraft(current => ({ ...current, stock: value }))} placeholder="批量库存" />
              <InlineInput value={skuBatchDraft.weight} onChange={value => setSkuBatchDraft(current => ({ ...current, weight: value }))} placeholder="批量重量" />
              <InlineInput value={skuBatchDraft.dimensions} onChange={value => setSkuBatchDraft(current => ({ ...current, dimensions: value }))} placeholder="批量长宽高" />
              <Button size="sm" onClick={applySkuBatch} disabled={!product || !skuRows.length}>填充启用 SKU</Button>
            </div>
            {lastSkuBatchSummary ? <p className="mt-2 text-[11px] font-semibold text-[var(--color-primary)]" data-ui="listing-sku-batch-fill-summary">{lastSkuBatchSummary}</p> : null}
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[var(--color-muted)]">
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">支持规格一 / 规格二组合</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">行级启用 / 停用</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">保存到当前店铺覆盖</span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1">SKU 图角色关联图片槽位</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full min-w-[1320px] text-left text-xs" aria-label="卖家后台 SKU 销售资料编辑表">
              <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
                <tr>
                  {['规格一', '规格二', '商家 SKU', '平台 SKU / SPU/SKC', 'SKU 图角色', '售价', '库存', '重量', '包装尺寸', '状态', '操作'].map(header => <th key={header} className="border-b border-[var(--color-border)] px-3 py-2">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {skuRows.map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 font-medium text-[var(--color-fg)]">
                      <InlineInput value={row.optionOne} onChange={value => updateSkuRow(row.id, 'optionOne', value)} placeholder="如 Black / 默认款" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 font-medium text-[var(--color-fg)]">
                      <InlineInput value={row.optionTwo} onChange={value => updateSkuRow(row.id, 'optionTwo', value)} placeholder="如 M / 标准版" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <InlineInput value={row.merchantSku} onChange={value => updateSkuRow(row.id, 'merchantSku', value)} placeholder="商家 SKU" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <InlineInput value={row.platformSku} onChange={value => updateSkuRow(row.id, 'platformSku', value)} placeholder="平台 SKU / 发布后回写" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <div className="flex min-w-[168px] items-center gap-2" data-ui="listing-sku-image-slot-preview"><select value={row.skuImageRole} onChange={event => updateSkuRow(row.id, 'skuImageRole', event.target.value)} className="min-w-[118px] flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" data-ui="listing-sku-image-slot-select" aria-label="选择 SKU 绑定图片槽位"><option value="">选择图片槽位</option>{imageSlots.filter(slot => slot.imageUrl).map(slot => <option key={slot.id} value={slot.label}>{slot.label} · {slot.role}</option>)}</select>{imageSlots.find(slot => slot.label === row.skuImageRole)?.imageUrl ? <img src={productImageSrc(imageSlots.find(slot => slot.label === row.skuImageRole)?.imageUrl || '')} alt={`${row.merchantSku || row.optionOne || 'SKU'}绑定图`} className="h-9 w-9 rounded-lg border border-[var(--color-border)] object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-[var(--color-border)] text-[10px] text-[var(--color-muted)]">SKU图</span>}</div>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-fg)]">
                      <InlineInput fieldId={rowIndex === 0 ? 'listing-field-sku-price' : undefined} value={row.price} onChange={value => updateSkuRow(row.id, 'price', value)} placeholder="售价" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <InlineInput value={row.stock} onChange={value => updateSkuRow(row.id, 'stock', value)} placeholder="库存" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <InlineInput value={row.weight} onChange={value => updateSkuRow(row.id, 'weight', value)} placeholder="重量" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3 text-[var(--color-muted)]">
                      <InlineInput value={row.dimensions} onChange={value => updateSkuRow(row.id, 'dimensions', value)} placeholder="长×宽×高" />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3" data-ui="listing-sku-row-readiness-status">
                      {(() => { const missing = [['merchantSku', '商家SKU'], ['price', '售价'], ['stock', '库存']].filter(([field]) => !String(row[field as keyof SellerSkuRow] || '').trim()).map(([, label]) => label); return <div className="space-y-1"><button type="button" onClick={() => updateSkuRow(row.id, 'enabled', !row.enabled)} className={row.enabled ? 'rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[11px] text-[var(--color-success)]' : 'rounded-full bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-muted)]'}>{row.enabled ? '启用' : '停用'}</button><p className={row.enabled && !missing.length ? 'text-[10px] font-semibold text-[var(--color-success)]' : 'text-[10px] font-semibold text-[var(--color-warning)]'}>{row.enabled ? (missing.length ? `待补：${missing.join('、')}` : '发布就绪') : '已停用，不进入发布'}</p></div> })()}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3">
                      <button
                        type="button"
                        onClick={() => removeSkuRow(row.id)}
                        disabled={skuRows.length <= 1}
                        className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EditorSection>

        <EditorSection id="listing-master-logistics" title="物流、包装与合规" description="发布前必须补齐重量、包装长宽高、发货地、禁限售和认证材料。" active={activeAnchor === 'listing-master-logistics'}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['weight', '包裹重量', 'listing-field-weight'],
              ['packageSize', '包装长宽高', 'listing-field-package-size'],
              ['shipFrom', '发货地', 'listing-field-ship-from'],
              ['leadTime', '发货时效', 'listing-field-lead-time'],
              ['compliance', '禁限售复核', 'listing-field-compliance'],
              ['certificate', '品牌/认证材料', 'listing-field-certificate'],
            ].map(([field, label, fieldId]) => (
              <EditableInput key={field} fieldId={fieldId} label={label} value={draft[field] || ''} onChange={value => updateDraft(field, value)} placeholder="待填写" />
            ))}
          </div>
        </EditorSection>

      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 shadow-[var(--shadow-sm)]">
        <Button variant="outline" onClick={resetDraft} disabled={!product || saving}>取消</Button>
        <Button variant="secondary" onClick={saveMaster} disabled={!product || saving}>{saving ? '保存中...' : '保存母版草稿'}</Button>
        <Button onClick={saveStoreOverride} disabled={!product || !activeStore || saving}>保存到店铺覆盖</Button>
      </div>
    </section>
  )
}

function EditorSection({ id, title, description, active, children }: { id: string; title: string; description: string; active?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={active ? 'scroll-mt-24 rounded-2xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-4 shadow-[var(--shadow-md)] transition' : 'scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition'}>
      <div className="mb-4">
        <h4 className="text-base font-semibold text-[var(--color-fg)]">{title}</h4>
        <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{description}</p>
      </div>
      {children}
    </section>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? 'inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[var(--color-success)]' : 'inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2 py-1 text-[var(--color-warning)]'}>
      {ok && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  )
}

function StatusMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2"><p className="text-[11px] text-[var(--color-muted)]">{label}</p><p className={ok ? 'mt-1 text-sm font-semibold text-[var(--color-success)]' : 'mt-1 text-sm font-semibold text-[var(--color-warning)]'}>{value}</p></div>
  )
}

function EditableInput({ label, value, onChange, placeholder, fieldId }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; fieldId?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <p className="text-xs font-semibold text-[var(--color-fg)]">{label}</p>
      <input
        id={fieldId}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
      />
    </div>
  )
}

function InlineInput({ value, onChange, placeholder, fieldId }: { value: string; onChange: (value: string) => void; placeholder: string; fieldId?: string }) {
  return (
    <input
      id={fieldId}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full min-w-[88px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)]"
    />
  )
}
