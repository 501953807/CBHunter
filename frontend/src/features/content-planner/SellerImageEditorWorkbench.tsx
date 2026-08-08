import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Plus, SlidersHorizontal, Upload } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { ContentAsset, ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'

const inputClass = 'text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]'

export type ImageEditOptions = {
  width: number
  height: number
  fit: string
  background: string
  brightness: number
  contrast: number
  sharpness: number
  auto_contrast: boolean
  unsharp_mask: boolean
  crop_mode: string
  crop_x: number
  crop_y: number
  crop_width: number
  crop_height: number
  rotate_degrees: number
  flip_horizontal: boolean
  flip_vertical: boolean
  watermark_text: string
  watermark_position: string
  watermark_opacity: number
  watermark_color: string
  output_format: string
  quality: number
}

export type MediaSlotPlan = {
  index: number
  role: string
  label: string
  imageUrl: string
  assetName: string
  sizeText: string
  publishable?: boolean
}

export type ImageWatermarkTemplateOption = {
  id: string
  name: string
  platform: string
  scope: string
  text: string
  position: string
  opacity: number
  color: string
}

export const listingImageRoleByIndex = (index: number) => {
  const roles = [
    { role: 'main_image', label: '主图' },
    { role: 'scene_image', label: '场景辅图' },
    { role: 'dimension_image', label: '尺寸图' },
    { role: 'detail_image', label: '细节图' },
    { role: 'sku_image', label: 'SKU图' },
    { role: 'description_image', label: '详情图' },
  ]
  return roles[index] || { role: `extra_image_${index + 1}`, label: `辅图 ${index + 1}` }
}

const assetImageUrl = (asset: ContentAsset) => {
  const explicitUrl = asset.extra?.url ? String(asset.extra.url) : ''
  return explicitUrl || `/api/v1/content/assets/${asset.id}/file`
}

const clampImageSlotIndex = (slotIndex: number, slotCount: number) => {
  if (!Number.isFinite(slotIndex)) return 1
  return Math.max(1, Math.min(Math.max(slotCount, 1), Math.floor(slotIndex)))
}

const buildImageProcessingSummary = (options: ImageEditOptions) => {
  const summary = [
    `尺寸 ${options.width}×${options.height}`,
    options.fit === 'cover' ? '居中裁切' : '完整留白',
    `背景 ${options.background || '保留'}`,
    `输出 ${options.output_format.toUpperCase()} / 质量 ${options.quality}`,
  ]
  if (options.rotate_degrees) summary.push(`旋转 ${options.rotate_degrees}°`)
  if (options.flip_horizontal) summary.push('水平翻转')
  if (options.flip_vertical) summary.push('垂直翻转')
  if (options.auto_contrast) summary.push('自动对比度')
  if (options.unsharp_mask || options.sharpness > 1) summary.push(`锐化 ${options.sharpness}`)
  if (options.brightness !== 1) summary.push(`亮度 ${options.brightness}`)
  if (options.contrast !== 1) summary.push(`对比 ${options.contrast}`)
  if (options.watermark_text) summary.push(`水印 ${options.watermark_position} / ${Math.round(options.watermark_opacity * 100)}%`)
  return summary
}

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
  const savedSlotPlanKey = (initialSavedSlotPlan || []).map(slot => `${slot.index}:${slot.imageUrl}:${slot.assetName}:${slot.publishable}`).join('|')
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
      }
    })
    setImageSlots(nextSlots)
    setActiveSlotIndex(clampImageSlotIndex(initialSlotIndex, nextSlots.length))
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
      setSlotPlanDirty(true)
    }
  }, [imageOptions])

  const activeSlot = imageSlots.find(slot => slot.index === activeSlotIndex) || imageSlots[0] || {
    index: 1,
    role: 'main_image',
    label: '主图',
    imageUrl: '',
    assetName: '',
    sizeText: '待补真实图片',
    publishable: true,
  }

  const isSlotPublishable = (slot: MediaSlotPlan) => slot.index === 1 || (typeof slot.publishable === 'boolean' ? slot.publishable : slot.index <= publishImageLimit)

  const relabelSlots = (slots: MediaSlotPlan[], preservePublishable = false) => slots.map((slot, index) => {
    const roleMeta = listingImageRoleByIndex(index)
    return { ...slot, index: index + 1, role: roleMeta.role, label: roleMeta.label, publishable: preservePublishable && typeof slot.publishable === 'boolean' ? slot.publishable : index + 1 <= publishImageLimit }
  })

  const replaceActiveSlotWithAsset = (asset: ContentAsset) => {
    setImageSlots(current => current.map(slot => slot.index === activeSlotIndex
      ? {
        ...slot,
        imageUrl: assetImageUrl(asset),
        assetName: asset.original_name || asset.id,
        sizeText: `${asset.width || imageOptions.width}×${asset.height || imageOptions.height}px`,
      }
      : slot))
    setSlotPlanDirty(true)
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
      }
    })
    setImageSlots(current => [...current, ...appendedSlots])
    setActiveSlotIndex(appendedSlots[0].index)
    setSelectedAssetIds([])
    setSlotPlanDirty(true)
  }

  const saveCurrentSlotPlan = async () => {
    await onSaveImageSlotPlan(imageSlots)
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

  const filterStyle = { filter: `brightness(${imageOptions.brightness}) contrast(${imageOptions.contrast})` }
  const publishableSlotCount = imageSlots.filter(slot => slot.imageUrl && isSlotPublishable(slot)).length
  const retainedAssetCount = imageSlots.filter(slot => slot.imageUrl && !isSlotPublishable(slot)).length
  const emptySlotCount = imageSlots.filter(slot => !slot.imageUrl).length
  const saveBlockedReason = !product
    ? '未选择商品，不能保存图片计划'
    : publishableSlotCount === 0
      ? '发布范围内没有可用图片，至少需要1张真实商品图'
      : ''
  const toolGroups = [
    { title: '调整', tools: ['消除笔', '裁剪旋转', '修改尺寸', '图片翻译', 'AI设计'] },
    { title: '更多工具', tools: ['智能抠图', '图片变清晰', '拼图', '切图', '商品堆品', '图片校正'] },
    { title: '标记工具', tools: ['涂鸦', '形状线条', '商品标尺', '放大镜'] },
  ]
  const editableToolHints: Record<string, string> = {
    消除笔: '记录局部擦除任务；当前不伪造擦除结果。',
    裁剪旋转: '切换完整留白/居中裁切，保存后由后端重新生成平台尺寸图。',
    修改尺寸: '设置为平台常用 800×800 方图。',
    图片翻译: '记录翻译处理任务，避免伪造翻译结果。',
    AI设计: '记录 AI 设计任务，后续接入可用图像组件。',
    智能抠图: '输出 PNG 白底图，用于主图白底规范。',
    图片变清晰: '提升锐化、对比度和自动对比度。',
    拼图: '生成 1080×1080 留白图，适合多图拼版前置。',
    切图: '设置居中裁切方图，用于平台缩略图。',
    商品堆品: '记录堆品处理任务，避免生成假商品组合图。',
    图片校正: '轻微提升亮度和对比度。',
    涂鸦: '记录标注画笔任务。',
    形状线条: '记录标注图形任务。',
    商品标尺: '记录尺寸标注任务。',
    放大镜: '记录细节放大任务。',
  }
  const processingSummary = buildImageProcessingSummary(imageOptions)
  const imagePreviewStyle = {
    ...filterStyle,
    transform: `rotate(${imageOptions.rotate_degrees}deg) scaleX(${imageOptions.flip_horizontal ? -1 : 1}) scaleY(${imageOptions.flip_vertical ? -1 : 1})`,
    transition: 'filter 160ms ease, transform 160ms ease',
  }
  const platformSizePresets = [
    { label: 'Shopee/TEMU 方图', width: 800, height: 800, fit: 'cover' },
    { label: 'TikTok 主图', width: 600, height: 600, fit: 'cover' },
    { label: '营销海报', width: 1080, height: 1080, fit: 'contain' },
  ]

  return (
    <section aria-label="Listing 图片编辑工作台" data-ui="listing-image-editor-workbench" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-2 text-xs">
        <span className="font-semibold text-[var(--color-primary)]">商品图片工作台：拖拽排序、空位补图、当前槽位替换</span>
        <span
          className="rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 font-semibold text-[var(--color-primary)]"
          data-ui="listing-image-active-slot-context"
          aria-label="Listing 图片编辑当前槽位"
        >
          当前槽位：{activeSlot.label} {activeSlot.index}/{imageSlots.length || 1}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant={slotPlanDirty ? 'warning' : 'success'}>{slotPlanDirty ? '槽位待保存' : '槽位已同步'}</Badge>
          {initialSavedSlotPlan?.length ? (
            <Badge variant="info" data-ui="restored-image-slot-plan-state">已回显保存计划</Badge>
          ) : null}
          <Badge variant="success">真实素材绑定</Badge>
        </div>
      </div>
      <div className="grid min-h-[560px] grid-cols-1 2xl:grid-cols-[220px_minmax(640px,1fr)_180px]">
        <aside aria-label="左侧图片工具栏" className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:border-b-0 2xl:border-r">
          <div className="space-y-4">
            {toolGroups.map(group => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">{group.title}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-2">
                  {group.tools.map(tool => (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => applyToolPreset(tool)}
                      className={tool === activeTool
                        ? 'rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-3 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'
                        : 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'}
                    >
                      <SlidersHorizontal className="mx-auto mb-1 h-4 w-4 text-[var(--color-muted)]" />
                      {tool}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div aria-label="图片编辑画布" className="relative grid place-items-center bg-[var(--color-bg)] p-8">
          {activeSlot.imageUrl ? (
            <div className="relative w-full max-w-[720px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]">
              <img src={productImageSrc(activeSlot.imageUrl)} alt={`${product?.product_name || '商品'}${activeSlot.label}`} className={imageOptions.fit === 'cover' ? 'aspect-square w-full object-cover' : 'aspect-square w-full object-contain'} style={imagePreviewStyle} data-ui="image-canvas-transform-preview" />
              {imageOptions.crop_mode === 'manual' && (
                <div
                  aria-label="图片裁切预览框"
                  data-ui="image-crop-preview-frame"
                  className="pointer-events-none absolute inset-8 rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)]/10"
                >
                  <span className="absolute left-2 top-2 rounded-full bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] shadow-[var(--shadow-sm)]">
                    裁切预览 {imageOptions.crop_width || imageOptions.width}×{imageOptions.crop_height || imageOptions.height}
                  </span>
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-xl bg-[var(--color-surface)]/95 px-3 py-2 text-xs font-semibold text-[var(--color-fg)] shadow-[var(--shadow-sm)]">
                {product?.product_name || '当前商品'}
              </div>
              <div className="absolute bottom-4 left-4 rounded-xl bg-[var(--color-surface)]/95 px-3 py-2 text-xs text-[var(--color-muted)] shadow-[var(--shadow-sm)]">
                {activeTool} · {imageOptions.width}×{imageOptions.height} · {imageOptions.fit === 'cover' ? '裁切' : '留白'} · {imageOptions.output_format.toUpperCase()}
              </div>
            </div>
          ) : (
            <label className="grid h-[420px] w-full max-w-[720px] cursor-pointer place-items-center rounded-2xl border border-dashed border-[var(--color-primary)] bg-[var(--color-surface)] text-center text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-primary-light)]">
              <input
                className="sr-only"
                data-ui="image-slot-file-input"
                type="file"
                accept="image/*"
                disabled={!product || loading || slotUploading}
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) void uploadSlotImage(file)
                  event.currentTarget.value = ''
                }}
              />
              <span>
                <Upload className="mx-auto mb-3 h-10 w-10 text-[var(--color-primary)]" />
                <span className="block font-semibold text-[var(--color-fg)]">上传图片到当前槽位</span>
                <span className="mt-1 block text-xs">当前为 {activeSlot.label}，仅接受真实商品图，不使用假图占位。</span>
              </span>
            </label>
          )}
          <div className="absolute left-4 top-4 max-w-[360px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 text-xs shadow-[var(--shadow-sm)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{activeSlot.label}</Badge>
              <span className="text-[var(--color-muted)]">当前工具：{activeTool}</span>
            </div>
            <p className="mt-2 leading-5 text-[var(--color-muted)]">{editableToolHints[activeTool]}</p>
            <p
              className={slotPlanDirty
                ? 'mt-2 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-2 py-1.5 text-[11px] font-semibold text-[var(--color-warning)]'
                : 'mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'}
              data-ui="image-slot-plan-dirty-state"
            >
              {slotPlanDirty ? '当前图片槽位有未保存变更，保存后才写入 Listing 图片计划。' : '当前槽位计划已同步到最近保存状态。'}
            </p>
            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[11px]" data-ui="image-workbench-publish-readiness-summary">
              <p className="font-semibold text-[var(--color-fg)]">发布范围校验</p>
              <p className="mt-1 text-[var(--color-muted)]">发布前{publishImageLimit}张：可发布 {publishableSlotCount} 张；素材池保留 {retainedAssetCount} 张；空槽位 {emptySlotCount} 个。</p>
              {saveBlockedReason ? (
                <p className="mt-1 font-semibold text-[var(--color-danger)]" data-ui="image-workbench-save-blocked-reason">{saveBlockedReason}</p>
              ) : (
                <p className="mt-1 font-semibold text-[var(--color-success)]" data-ui="image-workbench-save-ready-state">图片计划可保存，保存后仍需回到 Listing 校验平台素材规则。</p>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2" data-ui="image-processing-before-save-summary" aria-label="图片保存前处理摘要">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--color-fg)]">保存前处理摘要</p>
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{processingSummary.length} 项</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {processingSummary.map(item => (
                  <span key={item} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-muted)]" data-ui="image-processing-summary-chip">{item}</span>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-[var(--color-muted)]">
                宽度
                <input className={`${inputClass} mt-1 w-full`} type="number" value={imageOptions.width} onChange={event => setImageOptions(prev => ({ ...prev, width: Number(event.target.value) || prev.width }))} />
              </label>
              <label className="text-[var(--color-muted)]">
                高度
                <input className={`${inputClass} mt-1 w-full`} type="number" value={imageOptions.height} onChange={event => setImageOptions(prev => ({ ...prev, height: Number(event.target.value) || prev.height }))} />
              </label>
            </div>
            <div aria-label="平台图片尺寸预设" data-ui="image-platform-size-presets" className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
              <p className="mb-2 text-[11px] font-semibold text-[var(--color-fg)]">平台尺寸预设</p>
              <div className="grid gap-1.5">
                {platformSizePresets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setImageOptions(prev => ({ ...prev, width: preset.width, height: preset.height, fit: preset.fit, crop_width: preset.width, crop_height: preset.height }))}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left text-[11px] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                  >
                    <span className="font-semibold text-[var(--color-fg)]">{preset.label}</span> · {preset.width}×{preset.height} · {preset.fit === 'cover' ? '裁切' : '留白'}
                  </button>
                ))}
              </div>
            </div>
            <div aria-label="图片旋转翻转控制" data-ui="image-orientation-controls" className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]" onClick={() => setImageOptions(prev => ({ ...prev, rotate_degrees: (prev.rotate_degrees + 90) % 360 }))}>旋转90°</button>
              <button type="button" className={imageOptions.flip_horizontal ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]' : 'rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'} onClick={() => setImageOptions(prev => ({ ...prev, flip_horizontal: !prev.flip_horizontal }))}>水平翻转</button>
              <button type="button" className={imageOptions.flip_vertical ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]' : 'rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'} onClick={() => setImageOptions(prev => ({ ...prev, flip_vertical: !prev.flip_vertical }))}>垂直翻转</button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">当前方向：旋转 {imageOptions.rotate_degrees}°{imageOptions.flip_horizontal ? ' · 水平翻转' : ''}{imageOptions.flip_vertical ? ' · 垂直翻转' : ''}</p>
            <div
              aria-label="水印模板快速应用"
              data-ui="listing-image-watermark-template-picker"
              className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--color-fg)]">水印模板</p>
                <button
                  type="button"
                  onClick={onClearWatermark}
                  disabled={!imageOptions.watermark_text}
                  className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清除水印
                </button>
              </div>
              {watermarkTemplates.length > 0 ? (
                <div className="grid gap-1">
                  {watermarkTemplates.slice(0, 4).map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onApplyWatermarkTemplate?.(template)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                    >
                      <span className="block truncate font-semibold text-[var(--color-primary)]">应用水印模板：{template.name}</span>
                      <span className="block truncate text-[10px] text-[var(--color-muted)]">{template.platform} · {template.scope} · {template.position}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] leading-5 text-[var(--color-muted)]">暂无水印模板；请先在图片/水印模板维护真实模板。</p>
              )}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-3 py-2 font-semibold text-[var(--color-primary)]">
              <Upload className="h-4 w-4" />
              {slotUploading ? '上传处理中...' : '上传/替换当前槽位'}
              <input
                className="sr-only"
                data-ui="image-slot-file-input"
                type="file"
                accept="image/*"
                disabled={!product || loading || slotUploading}
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) void uploadSlotImage(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <div aria-label="当前图片槽位删除动作" className="mt-2 grid grid-cols-2 gap-2" data-ui="image-slot-clear-remove-actions">
              <button
                type="button"
                onClick={clearActiveSlot}
                disabled={!activeSlot.imageUrl || loading || slotUploading}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-warning)] transition hover:border-[var(--color-warning)] disabled:cursor-not-allowed disabled:opacity-40"
                data-ui="clear-active-image-slot"
              >
                清空当前槽位
              </button>
              <button
                type="button"
                onClick={removeActiveSlot}
                disabled={imageSlots.length <= 1 || loading || slotUploading}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-danger)] transition hover:border-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                data-ui="remove-active-image-slot"
              >
                删除当前槽位
              </button>
            </div>
          </div>
          <div className="absolute bottom-4 right-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!product}>取消</Button>
            <Button
              onClick={processSourceImageIntoActiveSlot}
              disabled={!sourceImage || loading || slotUploading}
              data-ui="process-source-image-into-active-slot"
            >
              {loading || slotUploading ? '处理中...' : '处理源图并替换当前槽位'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { void saveCurrentSlotPlan() }}
              disabled={!product || loading || slotUploading || Boolean(saveBlockedReason)}
              data-ui="save-dirty-image-slot-plan"
              title={saveBlockedReason || '保存当前图片槽位顺序和发布范围'}
            >
              {slotPlanDirty ? '保存槽位变更' : '保存槽位顺序'}
            </Button>
          </div>
        </div>

        <aside aria-label="右侧图片槽位缩略图" className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:border-l 2xl:border-t-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--color-fg)]">图片槽位</p>
              <p className="text-[10px] text-[var(--color-muted)]">拖拽缩略图调整主图/辅图顺序；前{publishImageLimit}张进入发布范围</p>
            </div>
            <div className="text-right">
              <span className="block text-xs text-[var(--color-primary)]">{activeSlot.index}/{imageSlots.length}</span>
              <button
                type="button"
                onClick={fillEmptySlotsFromAssets}
                disabled={!product || loading || slotUploading || productImageAssets.length === 0 || !imageSlots.some(slot => !slot.imageUrl)}
                className="mt-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-40"
                data-ui="fill-empty-image-slots-from-assets"
                aria-label="用当前商品真实素材填充空图片槽位"
                title="只使用绑定当前商品的真实素材填充空图片槽位"
              >
                一键填充空槽位
              </button>
            </div>
          </div>
          <div className="grid max-h-[500px] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6 2xl:block 2xl:space-y-3">
            {imageSlots.map(slot => (
              <div
                key={slot.index}
                draggable
                onDragStart={() => setDraggingSlotIndex(slot.index)}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault()
                  if (draggingSlotIndex !== null) reorderSlot(draggingSlotIndex, slot.index)
                  setDraggingSlotIndex(null)
                }}
                onDragEnd={() => setDraggingSlotIndex(null)}
                className={slot.index === activeSlot.index
                  ? 'rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-1 text-left shadow-[var(--shadow-sm)]'
                  : draggingSlotIndex === slot.index
                    ? 'rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary-light)] p-1 text-left opacity-70'
                    : 'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-left transition hover:border-[var(--color-primary)]'}
              >
                <button type="button" onClick={() => setActiveSlotIndex(slot.index)} className="block w-full text-left">
                  {slot.imageUrl ? (
                    <img src={productImageSrc(slot.imageUrl)} alt={slot.label} className="aspect-square w-full rounded-lg object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center rounded-lg bg-[var(--color-bg)] text-[10px] text-[var(--color-muted)]">待补图</div>
                  )}
                </button>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                  <span>{slot.sizeText}</span>
                  <span>{slot.index}/{imageSlots.length}</span>
                </div>
                <p
                  className={slot.index === 1 ? 'mt-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-primary)]' : isSlotPublishable(slot) ? 'mt-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-center text-[10px] font-semibold text-[var(--color-success)]' : 'mt-1 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-center text-[10px] text-[var(--color-muted)]'}
                  data-ui="image-workbench-slot-publish-state"
                >
                  {slot.index === 1 ? '平台主图' : isSlotPublishable(slot) ? `发布前${publishImageLimit}张` : '素材池保留'}
                </p>
                <div className="mt-1 grid grid-cols-1 gap-1 text-[10px]">
                  <button type="button" onClick={() => setAsMainImage(slot.index)} disabled={slot.index === 1 || !slot.imageUrl} className="rounded border border-[var(--color-border)] px-1 py-0.5 text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40">设为主图</button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addImageSlot}
              className="grid min-h-28 place-items-center rounded-xl border border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-2 text-center text-xs font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-surface)]"
              aria-label="新增图片空位"
              data-ui="listing-image-empty-slot"
            >
              <span>
                <Plus className="mx-auto mb-1 h-4 w-4" />
                新增图片空位
              </span>
            </button>
          </div>
          {productImageAssets.length > 0 && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[var(--color-fg)]">当前商品真实素材库</p>
                  <p className="text-[10px] text-[var(--color-muted)]">点选多张后可批量追加为图片槽位</p>
                </div>
                <button
                  type="button"
                  onClick={appendSelectedAssetsAsSlots}
                  disabled={!selectedAssetIds.length || loading || slotUploading}
                  className="rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-40"
                  data-ui="append-selected-assets-as-image-slots"
                  aria-label="将选中真实素材批量追加为图片槽位"
                >
                  批量追加槽位 {selectedAssetIds.length || ''}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 2xl:grid-cols-2">
                {productImageAssets.slice(0, 8).map(asset => (
                  <div
                    key={asset.id}
                    className={selectedAssetIds.includes(asset.id)
                      ? 'overflow-hidden rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-primary)]'}
                    data-ui="selectable-product-image-asset"
                  >
                    <button
                      type="button"
                      data-ui="replace-active-slot-with-asset"
                      onClick={() => replaceActiveSlotWithAsset(asset)}
                      className="block w-full"
                      title="放入当前槽位"
                    >
                      <img src={productImageSrc(assetImageUrl(asset))} alt={asset.original_name || asset.id} className="aspect-square w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAssetSelection(asset.id)}
                      className="block w-full border-t border-[var(--color-border)] px-1 py-1 text-[10px] font-semibold text-[var(--color-primary)]"
                      aria-label="选择真实素材用于批量追加槽位"
                    >
                      {selectedAssetIds.includes(asset.id) ? '已选' : '选择'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
