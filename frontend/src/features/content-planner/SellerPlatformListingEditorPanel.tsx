import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { confirmContentTaskVersion, saveContentTaskVersion, type ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'
import { useToast } from '../../components/ui/Toast'
import { logger } from '../../utils/logger'
import { PlatformFieldGroupEditor, type PlatformRequirementsLike } from '../../components/shared/PlatformFieldGroups'
import { ListingCopyAiAssistPanel } from './ListingCopyAiAssistPanel'
import { EditableInput, EditorSection, InlineInput, ListingEditorHeader, ListingImageSlotSection } from './SellerPlatformListingEditorParts'
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
  const readinessSnapshot: Array<[string, string | number, boolean]> = [['发布图', `${listingImageCount}/${minImages}`, listingImageCount >= minImages], ['属性', `${filledAttributes}/${requiredAttributes.length || 0}`, requiredAttributes.length > 0 && filledAttributes >= requiredAttributes.length], ['SKU', `${skuReadyCount}/${enabledSkuCount || 0}`, enabledSkuCount > 0 && skuReadyCount >= enabledSkuCount], ['店铺', activeStore || '待选择', Boolean(activeStore)]]

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      logger.error('Save unified listing master failed', error)
      toast.addToast('error', (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '统一 Listing 母版保存失败')
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
    } catch (error: unknown) {
      logger.error('Save listing store override failed', error)
      toast.addToast('error', (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '店铺覆盖字段保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="统一 Listing 母版编辑器" data-ui="unified-listing-master-editor" className="listing-editor-shell overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <ListingEditorHeader
        product={product}
        activeStore={activeStore}
        listingImageCount={listingImageCount}
        minImages={minImages}
        filledAttributes={filledAttributes}
        requiredAttributes={requiredAttributes}
        readinessSnapshot={readinessSnapshot}
        anchors={anchors}
        activeAnchor={activeAnchor}
        jump={jump}
        listingGaps={listingGaps}
        activeGap={activeGap}
        anchorLabel={anchorLabel}
        targetLabel={targetLabel}
        changeTab={changeTab}
      />

	      <div className="space-y-5 p-5">
        <ListingImageSlotSection
          active={activeAnchor === 'listing-master-media'}
          product={product}
          imageSlots={imageSlots}
          draggingImageIndex={draggingImageIndex}
          recommendedImages={recommendedImages}
          minImages={minImages}
          publishableSlotImageCount={publishableSlotImageCount}
          confirmedSlotCount={confirmedSlotCount}
          confirmedPublishableCount={confirmedPublishableCount}
          confirmedRetainedCount={confirmedRetainedCount}
          changeTab={changeTab}
          onDragStart={setDraggingImageIndex}
          onDrop={dropImageSlot}
          onDragEnd={() => setDraggingImageIndex(null)}
          onSetMainImage={setMainImage}
          onAddImageSlot={addImageSlot}
        />

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
