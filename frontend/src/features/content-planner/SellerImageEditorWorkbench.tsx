import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ContentAsset, ContentWorkbenchItem } from '../../api/content'
import { assetImageUrl, clampImageSlotIndex, listingImageRoleByIndex } from './SellerImageEditorUtils'
import { SellerImageCanvasPanel, SellerImageSlotRail } from './SellerImageEditorWorkbenchCanvasParts'
import { SellerImageToolRail, SellerImageWorkbenchHeader } from './SellerImageEditorWorkbenchParts'
import type { ImageEditOptions, ImageWatermarkTemplateOption, MediaSlotPlan } from './SellerImageEditorTypes'
export { listingImageRoleByIndex } from './SellerImageEditorUtils'
export type { ImageEditOptions, ImageWatermarkTemplateOption, MediaSlotPlan } from './SellerImageEditorTypes'

export function SellerImageEditorWorkbench({
  product,
  productImageAssets,
  imageOptions,
  setImageOptions,
  onUseSourceImage,
  onUploadSlotImage,
  onSaveImageSlotPlan,
  loading,
  initialSlotIndex = 1,
  initialSavedSlotPlan = null,
  watermarkTemplates = [],
  onApplyWatermarkTemplate,
  onClearWatermark,
}: {
  product: ContentWorkbenchItem | null
  productImageAssets: ContentAsset[]
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  onUseSourceImage: () => Promise<ContentAsset | null>
  onUploadSlotImage: (file: File) => Promise<ContentAsset | null>
  onSaveImageSlotPlan: (slots: MediaSlotPlan[]) => Promise<void>
  loading: boolean
  initialSlotIndex?: number
  initialSavedSlotPlan?: MediaSlotPlan[] | null
  watermarkTemplates?: ImageWatermarkTemplateOption[]
  onApplyWatermarkTemplate?: (template: ImageWatermarkTemplateOption) => void
  onClearWatermark?: () => void
}) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(1)
  const [activeTool, setActiveTool] = useState('修改尺寸')
  const [draggingSlotIndex, setDraggingSlotIndex] = useState<number | null>(null)
  const [slotUploading, setSlotUploading] = useState(false)
  const [slotPlanDirty, setSlotPlanDirty] = useState(false)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const imageOptionsKeyRef = useRef('')
  const sourceImage = product?.image_url || ''
  const slotCount = Math.max(product?.media_readiness?.recommended_platform_images ?? 9, 9)
  const publishImageLimit = product?.media_readiness?.recommended_platform_images ?? 9
  const imageAssetKey = productImageAssets.map(asset => `${asset.id}:${asset.created_at}`).join('|')
  const savedSlotPlanKey = (initialSavedSlotPlan || []).map(slot => `${slot.index}:${slot.imageUrl}:${slot.assetName}:${slot.publishable}:${slot.exportStatus}:${slot.generatedAssetUrl}:${slot.editOptions ? JSON.stringify(slot.editOptions) : ''}`).join('|')
  const [imageSlots, setImageSlots] = useState<MediaSlotPlan[]>([])

  useEffect(() => {
    const savedSlots = initialSavedSlotPlan?.length ? relabelSlots(initialSavedSlotPlan, true) : null
    const nextSlots = savedSlots || Array.from({ length: slotCount }).map((_, index) => {
      const asset = productImageAssets[index - 1]
      const imageUrl = index === 0 ? sourceImage : asset ? assetImageUrl(asset) : ''
      const roleMeta = listingImageRoleByIndex(index)
      return {
        index: index + 1,
        role: roleMeta.role,
        label: roleMeta.label,
        imageUrl,
        assetName: asset?.original_name || '',
        sizeText: asset ? `${asset.width}×${asset.height}px` : imageUrl ? '源图待处理' : '待补真实图片',
        publishable: index + 1 <= publishImageLimit,
        editOptions: imageOptions,
      }
    })
    setImageSlots(nextSlots)
    const nextActiveSlotIndex = clampImageSlotIndex(initialSlotIndex, nextSlots.length)
    const nextActiveSlotOptions = nextSlots[nextActiveSlotIndex - 1]?.editOptions
    if (nextActiveSlotOptions) {
      imageOptionsKeyRef.current = JSON.stringify(nextActiveSlotOptions)
      setImageOptions(nextActiveSlotOptions)
    }
    setActiveSlotIndex(nextActiveSlotIndex)
    setSlotPlanDirty(false)
    setSelectedAssetIds([])
  }, [product?.id, imageAssetKey, initialSlotIndex, savedSlotPlanKey, slotCount, sourceImage])

  useEffect(() => {
    if (!imageSlots.length) return
    setActiveSlotIndex(clampImageSlotIndex(initialSlotIndex, imageSlots.length))
  }, [imageSlots.length, initialSlotIndex])

  useEffect(() => {
    const nextKey = JSON.stringify(imageOptions)
    if (!imageOptionsKeyRef.current) {
      imageOptionsKeyRef.current = nextKey
      return
    }
    if (imageOptionsKeyRef.current !== nextKey) {
      imageOptionsKeyRef.current = nextKey
      setImageSlots(current => current.map(slot => slot.index === activeSlotIndex ? { ...slot, editOptions: imageOptions } : slot))
      setSlotPlanDirty(true)
    }
  }, [imageOptions, activeSlotIndex])

  const activeSlot = imageSlots.find(slot => slot.index === activeSlotIndex) || imageSlots[0] || {
    index: 1,
    role: 'main_image',
    label: '主图',
    imageUrl: '',
    assetName: '',
    sizeText: '待补真实图片',
    publishable: true,
    editOptions: imageOptions,
  }

  useEffect(() => {
    if (!activeSlot.editOptions) return
    const nextKey = JSON.stringify(activeSlot.editOptions)
    if (imageOptionsKeyRef.current === nextKey) return
    imageOptionsKeyRef.current = nextKey
    setImageOptions(activeSlot.editOptions)
  }, [activeSlotIndex])

  const isSlotPublishable = (slot: MediaSlotPlan) => slot.index === 1 || (typeof slot.publishable === 'boolean' ? slot.publishable : slot.index <= publishImageLimit)

  const relabelSlots = (slots: MediaSlotPlan[], preservePublishable = false) => slots.map((slot, index) => {
    const roleMeta = listingImageRoleByIndex(index)
    return { ...slot, index: index + 1, role: roleMeta.role, label: roleMeta.label, publishable: preservePublishable && typeof slot.publishable === 'boolean' ? slot.publishable : index + 1 <= publishImageLimit }
  })

  const replaceSlotWithAsset = (slotIndex: number, asset: ContentAsset) => {
    setImageSlots(current => current.map(slot => slot.index === slotIndex
      ? {
        ...slot,
        imageUrl: assetImageUrl(asset),
        assetName: asset.original_name || asset.id,
        sizeText: `${asset.width || imageOptions.width}×${asset.height || imageOptions.height}px`,
        editOptions: imageOptions,
      }
      : slot))
    setActiveSlotIndex(slotIndex)
    setSlotPlanDirty(true)
  }

  const replaceActiveSlotWithAsset = (asset: ContentAsset) => {
    replaceSlotWithAsset(activeSlotIndex, asset)
  }

  const uploadSlotImage = async (file: File) => {
    setSlotUploading(true)
    try {
      const asset = await onUploadSlotImage(file)
      if (asset) replaceActiveSlotWithAsset(asset)
    } finally {
      setSlotUploading(false)
    }
  }

  const processSourceImageIntoActiveSlot = async () => {
    setSlotUploading(true)
    try {
      const asset = await onUseSourceImage()
      if (asset) replaceActiveSlotWithAsset(asset)
    } finally {
      setSlotUploading(false)
    }
  }

  const reorderSlot = (fromSlotIndex: number, toSlotIndex: number) => {
    if (fromSlotIndex === toSlotIndex) return
    const currentIndex = imageSlots.findIndex(slot => slot.index === fromSlotIndex)
    const targetIndex = imageSlots.findIndex(slot => slot.index === toSlotIndex)
    if (currentIndex < 0 || targetIndex < 0) return
    const nextSlots = [...imageSlots]
    const [removed] = nextSlots.splice(currentIndex, 1)
    nextSlots.splice(targetIndex, 0, removed)
    const relabeled = relabelSlots(nextSlots)
    setImageSlots(relabeled)
    setActiveSlotIndex(targetIndex + 1)
    setSlotPlanDirty(true)
  }

  const addImageSlot = () => {
    const nextIndex = imageSlots.length + 1
    const roleMeta = listingImageRoleByIndex(nextIndex - 1)
    setImageSlots(current => [...current, {
      index: nextIndex,
      role: roleMeta.role,
      label: roleMeta.label,
      imageUrl: '',
      assetName: '',
      sizeText: '新增图片空位',
      publishable: nextIndex <= publishImageLimit,
      editOptions: imageOptions,
    }])
    setActiveSlotIndex(nextIndex)
    setSlotPlanDirty(true)
  }

  const setAsMainImage = (slotIndex: number) => {
    const currentIndex = imageSlots.findIndex(slot => slot.index === slotIndex)
    if (currentIndex <= 0) return
    const nextSlots = [...imageSlots]
    const [removed] = nextSlots.splice(currentIndex, 1)
    nextSlots.unshift(removed)
    setImageSlots(relabelSlots(nextSlots))
    setActiveSlotIndex(1)
    setSlotPlanDirty(true)
  }

  const clearActiveSlot = () => {
    setImageSlots(current => current.map(slot => slot.index === activeSlotIndex
      ? { ...slot, imageUrl: '', assetName: '', sizeText: '已清空，待补真实图片' }
      : slot))
    setSlotPlanDirty(true)
  }

  const removeActiveSlot = () => {
    if (imageSlots.length <= 1) return
    const nextSlots = relabelSlots(imageSlots.filter(slot => slot.index !== activeSlotIndex))
    setImageSlots(nextSlots)
    setActiveSlotIndex(clampImageSlotIndex(activeSlotIndex, nextSlots.length))
    setSlotPlanDirty(true)
  }

  const fillEmptySlotsFromAssets = () => {
    const usedImageUrls = new Set(imageSlots.map(slot => slot.imageUrl).filter(Boolean))
    const availableAssets = productImageAssets
      .map(asset => ({ asset, imageUrl: assetImageUrl(asset) }))
      .filter(item => !usedImageUrls.has(item.imageUrl))
    if (!availableAssets.length) return

    let nextAssetIndex = 0
    let firstFilledSlotIndex = activeSlotIndex
    const nextSlots = imageSlots.map(slot => {
      if (slot.imageUrl || nextAssetIndex >= availableAssets.length) return slot
      const { asset, imageUrl } = availableAssets[nextAssetIndex]
      nextAssetIndex += 1
      if (nextAssetIndex === 1) firstFilledSlotIndex = slot.index
      return {
        ...slot,
        imageUrl,
        assetName: asset.original_name || asset.id,
        sizeText: `${asset.width || imageOptions.width}×${asset.height || imageOptions.height}px`,
        publishable: slot.index <= publishImageLimit,
        editOptions: imageOptions,
      }
    })

    if (nextAssetIndex === 0) return
    setImageSlots(nextSlots)
    setActiveSlotIndex(firstFilledSlotIndex)
    setSlotPlanDirty(true)
  }

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssetIds(current => current.includes(assetId)
      ? current.filter(id => id !== assetId)
      : [...current, assetId])
  }

  const appendSelectedAssetsAsSlots = () => {
    const usedImageUrls = new Set(imageSlots.map(slot => slot.imageUrl).filter(Boolean))
    const selectedAssets = productImageAssets
      .filter(asset => selectedAssetIds.includes(asset.id))
      .map(asset => ({ asset, imageUrl: assetImageUrl(asset) }))
      .filter(item => !usedImageUrls.has(item.imageUrl))
    if (!selectedAssets.length) return

    const appendedSlots = selectedAssets.map(({ asset, imageUrl }, index) => {
      const nextIndex = imageSlots.length + index + 1
      const roleMeta = listingImageRoleByIndex(nextIndex - 1)
      return {
        index: nextIndex,
        role: roleMeta.role,
        label: roleMeta.label,
        imageUrl,
        assetName: asset.original_name || asset.id,
        sizeText: `${asset.width || imageOptions.width}×${asset.height || imageOptions.height}px`,
        publishable: nextIndex <= publishImageLimit,
        editOptions: imageOptions,
      }
    })
    setImageSlots(current => [...current, ...appendedSlots])
    setActiveSlotIndex(appendedSlots[0].index)
    setSelectedAssetIds([])
    setSlotPlanDirty(true)
  }

  const saveCurrentSlotPlan = async () => {
    const slotsToSave = imageSlots.map(slot => slot.index === activeSlotIndex ? { ...slot, editOptions: imageOptions } : slot)
    await onSaveImageSlotPlan(slotsToSave)
    setImageSlots(slotsToSave)
    setSlotPlanDirty(false)
  }

  const applyToolPreset = (tool: string) => {
    setActiveTool(tool)
    if (tool === '裁剪旋转') {
      setImageOptions(prev => ({ ...prev, fit: 'cover', crop_mode: 'manual', crop_width: prev.width, crop_height: prev.height, rotate_degrees: (prev.rotate_degrees + 90) % 360 }))
      return
    }
    if (tool === '修改尺寸') {
      setImageOptions(prev => ({ ...prev, width: 800, height: 800, fit: 'cover' }))
      return
    }
    if (tool === '图片变清晰') {
      setImageOptions(prev => ({ ...prev, sharpness: 2, unsharp_mask: true, auto_contrast: true, contrast: 1.1 }))
      return
    }
    if (tool === '图片校正') {
      setImageOptions(prev => ({ ...prev, brightness: 1.05, contrast: 1.08, auto_contrast: true }))
      return
    }
    if (tool === '智能抠图') {
      setImageOptions(prev => ({ ...prev, background: 'white', output_format: 'png', fit: 'contain' }))
      return
    }
    if (tool === '拼图') {
      setImageOptions(prev => ({ ...prev, width: 1080, height: 1080, fit: 'contain' }))
      return
    }
    if (tool === '切图') {
      setImageOptions(prev => ({ ...prev, width: 800, height: 800, fit: 'cover', crop_mode: 'manual', crop_width: 800, crop_height: 800 }))
    }
  }

  const publishableSlotCount = imageSlots.filter(slot => slot.imageUrl && isSlotPublishable(slot)).length
  const exportedSlotCount = imageSlots.filter(slot => slot.exportStatus === 'exported_to_content_asset').length
  const exportFailedSlotCount = imageSlots.filter(slot => slot.exportStatus === 'export_failed').length
  const saveBlockedReason = !product
    ? '未选择商品，不能保存图片计划'
    : publishableSlotCount === 0
      ? '发布范围内没有可用图片，至少需要1张真实商品图'
      : ''
  return (
    <section aria-label="Listing 图片编辑工作台" data-ui="listing-image-editor-workbench" className="image-workbench-shell overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <SellerImageWorkbenchHeader
        activeSlot={activeSlot}
        slotCount={imageSlots.length}
        slotPlanDirty={slotPlanDirty}
        restoredSlotPlan={Boolean(initialSavedSlotPlan?.length)}
        exportedSlotCount={exportedSlotCount}
        exportFailedSlotCount={exportFailedSlotCount}
        imageSlotWithImageCount={imageSlots.filter(slot => slot.imageUrl).length}
      />
      <div className="grid min-h-[560px] grid-cols-1 2xl:grid-cols-[220px_minmax(640px,1fr)_180px]">
        <SellerImageToolRail activeTool={activeTool} onApplyToolPreset={applyToolPreset} />

        <SellerImageCanvasPanel
          product={product}
          activeSlot={activeSlot}
          imageSlots={imageSlots}
          imageOptions={imageOptions}
          setImageOptions={setImageOptions}
          activeTool={activeTool}
          slotPlanDirty={slotPlanDirty}
          slotUploading={slotUploading}
          loading={loading}
          sourceImage={sourceImage}
          publishImageLimit={publishImageLimit}
          saveBlockedReason={saveBlockedReason}
          watermarkTemplates={watermarkTemplates}
          onUploadSlotImage={file => { void uploadSlotImage(file) }}
          onUseSourceImage={() => { void processSourceImageIntoActiveSlot() }}
          onSaveImageSlotPlan={() => { void saveCurrentSlotPlan() }}
          onClearActiveSlot={clearActiveSlot}
          onRemoveActiveSlot={removeActiveSlot}
          onClearWatermark={onClearWatermark}
          onApplyWatermarkTemplate={onApplyWatermarkTemplate}
        />

        <SellerImageSlotRail
          product={product}
          productImageAssets={productImageAssets}
          imageSlots={imageSlots}
          activeSlot={activeSlot}
          activeSlotIndex={activeSlot.index}
          draggingSlotIndex={draggingSlotIndex}
          selectedAssetIds={selectedAssetIds}
          publishImageLimit={publishImageLimit}
          loading={loading}
          slotUploading={slotUploading}
          onSetActiveSlotIndex={setActiveSlotIndex}
          onSetDraggingSlotIndex={setDraggingSlotIndex}
          onReorderSlot={reorderSlot}
          onReplaceSlotWithAsset={replaceSlotWithAsset}
          onReplaceActiveSlotWithAsset={replaceActiveSlotWithAsset}
          onSetAsMainImage={setAsMainImage}
          onFillEmptySlotsFromAssets={fillEmptySlotsFromAssets}
          onAddImageSlot={addImageSlot}
          onAppendSelectedAssetsAsSlots={appendSelectedAssetsAsSlots}
          onToggleAssetSelection={toggleAssetSelection}
          isSlotPublishable={isSlotPublishable}
        />
      </div>
    </section>
  )
}
