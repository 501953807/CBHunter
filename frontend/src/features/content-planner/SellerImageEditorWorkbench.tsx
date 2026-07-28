import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
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

export function SellerImageEditorWorkbench({
  product,
  productImageAssets,
  imageOptions,
  setImageOptions,
  onUseSourceImage,
  onUploadSlotImage,
  onSaveImageSlotPlan,
  loading,
}: {
  product: ContentWorkbenchItem | null
  productImageAssets: ContentAsset[]
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  onUseSourceImage: () => void
  onUploadSlotImage: (file: File) => Promise<ContentAsset | null>
  onSaveImageSlotPlan: (slots: MediaSlotPlan[]) => void
  loading: boolean
}) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(1)
  const [activeTool, setActiveTool] = useState('修改尺寸')
  const [draggingSlotIndex, setDraggingSlotIndex] = useState<number | null>(null)
  const [slotUploading, setSlotUploading] = useState(false)
  const sourceImage = product?.image_url || ''
  const slotCount = Math.max(product?.media_readiness?.recommended_platform_images ?? 9, 9)
  const imageAssetKey = productImageAssets.map(asset => `${asset.id}:${asset.created_at}`).join('|')
  const [imageSlots, setImageSlots] = useState<MediaSlotPlan[]>([])

  useEffect(() => {
    const nextSlots = Array.from({ length: slotCount }).map((_, index) => {
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
      }
    })
    setImageSlots(nextSlots)
    setActiveSlotIndex(1)
  }, [product?.id, imageAssetKey, slotCount, sourceImage])

  const activeSlot = imageSlots.find(slot => slot.index === activeSlotIndex) || imageSlots[0] || {
    index: 1,
    role: 'main_image',
    label: '主图',
    imageUrl: '',
    assetName: '',
    sizeText: '待补真实图片',
  }

  const relabelSlots = (slots: MediaSlotPlan[]) => slots.map((slot, index) => {
    const roleMeta = listingImageRoleByIndex(index)
    return { ...slot, index: index + 1, role: roleMeta.role, label: roleMeta.label }
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
    }])
    setActiveSlotIndex(nextIndex)
  }

  const setAsMainImage = (slotIndex: number) => {
    const currentIndex = imageSlots.findIndex(slot => slot.index === slotIndex)
    if (currentIndex <= 0) return
    const nextSlots = [...imageSlots]
    const [removed] = nextSlots.splice(currentIndex, 1)
    nextSlots.unshift(removed)
    setImageSlots(relabelSlots(nextSlots))
    setActiveSlotIndex(1)
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

  return (
    <section aria-label="Listing 图片编辑工作台" data-ui="listing-image-editor-workbench" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-2 text-xs">
        <span className="font-semibold text-[var(--color-primary)]">商品图片工作台：拖拽排序、空位补图、当前槽位替换</span>
        <Badge variant="success">真实素材绑定</Badge>
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
              <img
                src={productImageSrc(activeSlot.imageUrl)}
                alt={`${product?.product_name || '商品'}${activeSlot.label}`}
                className={imageOptions.fit === 'cover' ? 'aspect-square w-full object-cover' : 'aspect-square w-full object-contain'}
                style={filterStyle}
              />
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
            <div aria-label="图片旋转翻转控制" data-ui="image-orientation-controls" className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]" onClick={() => setImageOptions(prev => ({ ...prev, rotate_degrees: (prev.rotate_degrees + 90) % 360 }))}>旋转90°</button>
              <button type="button" className={imageOptions.flip_horizontal ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]' : 'rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'} onClick={() => setImageOptions(prev => ({ ...prev, flip_horizontal: !prev.flip_horizontal }))}>水平翻转</button>
              <button type="button" className={imageOptions.flip_vertical ? 'rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-1.5 text-[11px] text-[var(--color-primary)]' : 'rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]'} onClick={() => setImageOptions(prev => ({ ...prev, flip_vertical: !prev.flip_vertical }))}>垂直翻转</button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">当前方向：旋转 {imageOptions.rotate_degrees}°{imageOptions.flip_horizontal ? ' · 水平翻转' : ''}{imageOptions.flip_vertical ? ' · 垂直翻转' : ''}</p>
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
          </div>
          <div className="absolute bottom-4 right-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!product}>取消</Button>
            <Button onClick={onUseSourceImage} disabled={!sourceImage || loading}>{loading ? '处理中...' : '处理源图为素材'}</Button>
            <Button variant="secondary" onClick={() => onSaveImageSlotPlan(imageSlots)} disabled={!product || loading}>保存槽位顺序</Button>
          </div>
        </div>

        <aside aria-label="右侧图片槽位缩略图" className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-3 2xl:border-l 2xl:border-t-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--color-fg)]">图片槽位</p>
              <p className="text-[10px] text-[var(--color-muted)]">拖拽缩略图调整主图/辅图顺序</p>
            </div>
            <span className="text-xs text-[var(--color-primary)]">{activeSlot.index}/{imageSlots.length}</span>
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
              <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">素材放入当前槽位</p>
              <div className="grid grid-cols-3 gap-2 2xl:grid-cols-2">
                {productImageAssets.slice(0, 8).map(asset => (
                  <button
                    key={asset.id}
                    type="button"
                    data-ui="replace-active-slot-with-asset"
                    onClick={() => replaceActiveSlotWithAsset(asset)}
                    className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-primary)]"
                    title="放入当前槽位"
                  >
                    <img src={productImageSrc(assetImageUrl(asset))} alt={asset.original_name || asset.id} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
