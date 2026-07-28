import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Download, Film, Image, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import {
  deleteContentAsset,
  downloadContentAsset,
  editContentImage,
  editContentImageFromUrl,
  getContentAssets,
  renderContentVideo,
  saveContentTaskVersion,
  confirmContentTaskVersion,
  type ContentAsset,
  type ContentWorkbenchItem,
} from '../../api/content'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import {
  SellerImageEditorWorkbench,
  listingImageRoleByIndex,
  type ImageEditOptions,
  type MediaSlotPlan,
} from './SellerImageEditorWorkbench'

const inputClass = 'text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]'

export function ContentMediaStudio({ mode = 'all', product }: { mode?: 'all' | 'image' | 'video'; product?: ContentWorkbenchItem | null }) {
  const toast = useToast()
  const confirmAction = useConfirm()
  const [assets, setAssets] = useState<ContentAsset[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<ContentAsset[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [imageOptions, setImageOptions] = useState<ImageEditOptions>({
    width: 1080, height: 1080, fit: 'contain', background: 'white',
    brightness: 1, contrast: 1, sharpness: 1, auto_contrast: true,
    unsharp_mask: true, crop_mode: 'none', crop_x: 0, crop_y: 0,
    crop_width: 800, crop_height: 800, watermark_text: '',
    rotate_degrees: 0, flip_horizontal: false, flip_vertical: false,
    watermark_position: 'bottom_right', watermark_opacity: 0.32,
    watermark_color: '#FFFFFF', output_format: 'jpeg', quality: 88,
  })
  const [videoOptions, setVideoOptions] = useState({
    width: 1080, height: 1920, fit: 'contain', background: 'white', seconds_per_image: 2,
  })

  const loadAssets = async () => {
    try {
      const response = await getContentAssets()
      setAssets(response.data || [])
      setEvidence(response)
    } catch (error: any) {
      logger.error('Load content assets failed', error)
      toast.addToast('error', '素材列表加载失败')
    }
  }

  useEffect(() => { loadAssets() }, [])

  const runImageEdit = async () => {
    if (!imageFile) return
    setLoading(true)
    try {
      const response = await editContentImage(imageFile, {
        ...imageOptions,
        content_item_id: product?.id || '',
      })
      toast.addToast('success', `图片已处理：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Edit content image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片处理失败')
    } finally {
      setLoading(false)
    }
  }

  const uploadSlotImage = async (file: File) => {
    if (!product) {
      toast.addToast('warning', '请先选择要编辑的商品')
      return null
    }
    setLoading(true)
    try {
      const response = await editContentImage(file, {
        ...imageOptions,
        content_item_id: product.id,
      })
      toast.addToast('success', `已上传并处理当前槽位图片：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
      return response.data || null
    } catch (error: any) {
      logger.error('Upload listing slot image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '槽位图片上传失败')
      return null
    } finally {
      setLoading(false)
    }
  }

  const runSourceImageEdit = async () => {
    if (!product?.image_url) return
    setLoading(true)
    try {
      const response = await editContentImageFromUrl({
        image_url: product.image_url,
        content_item_id: product.id,
        ...imageOptions,
      })
      toast.addToast('success', `已用商品源图生成素材：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Edit source image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '商品源图处理失败')
    } finally {
      setLoading(false)
    }
  }

  const saveImageSlotPlan = async (slots: MediaSlotPlan[]) => {
    if (!product) return
    setLoading(true)
    try {
      const payload = JSON.stringify({
        schema: 'listing_image_slots.v1',
        product_id: product.id,
        slots: slots.map((slot, index) => {
          const roleMeta = listingImageRoleByIndex(index)
          return {
            position: index + 1,
            role: slot.role || roleMeta.role,
            label: slot.label || roleMeta.label,
            image_url: slot.imageUrl,
            asset_name: slot.assetName,
            size: slot.sizeText,
            edit_options: imageOptions,
          }
        }),
        image_edit_options: imageOptions,
        boundary: 'content_workbench_image_plan',
      }, null, 2)
      const saved = await saveContentTaskVersion(product.id, 'image_edit_plan', payload, 'manual_image_slot_plan')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, 'image_edit_plan', version)
      toast.addToast('success', '图片槽位顺序已保存到当前商品 Listing 图片计划')
      await loadAssets()
    } catch (error: any) {
      logger.error('Save image slot plan failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片槽位保存失败')
    } finally {
      setLoading(false)
    }
  }

  const runVideoRender = async () => {
    if (videoFiles.length === 0) return
    setLoading(true)
    try {
      const response = await renderContentVideo(videoFiles, videoOptions)
      toast.addToast('success', `视频已生成：${response.data?.duration_seconds || 0} 秒`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Render content video failed', error)
      toast.addToast('error', error?.response?.data?.detail || '视频生成失败')
    } finally {
      setLoading(false)
    }
  }

  const download = async (asset: ContentAsset) => {
    try {
      const blob = await downloadContentAsset(asset.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = asset.original_name || `content-${asset.id}.${asset.asset_type === 'video' ? 'mp4' : asset.mime_type.split('/')[1]}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      logger.error('Download content asset failed', error)
      toast.addToast('error', '素材下载失败')
    }
  }

  const remove = async (asset: ContentAsset) => {
    const ok = await confirmAction({
      title: '删除内容素材',
      message: `确认删除素材「${asset.original_name || asset.id}」？删除后该图片/视频不能继续用于当前 Listing 内容制作。`,
      confirmText: '确认删除素材',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteContentAsset(asset.id)
      setAssets(current => current.filter(item => item.id !== asset.id))
      toast.addToast('success', '素材已删除')
    } catch (error: any) {
      logger.error('Delete content asset failed', error)
      toast.addToast('error', '素材删除失败')
    }
  }

  const productAssets = product ? assets.filter(asset => String(asset.extra?.content_item_id || '') === product.id) : []
  const productImageAssets = productAssets.filter(asset => asset.asset_type === 'image')
  const productVideoAssets = productAssets.filter(asset => asset.asset_type === 'video')
  const jumpTo = (id: string) => document.getElementById(`listing-media-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="space-y-4" data-ui="listing-media-editor-seller-console">
      <nav aria-label="Listing 媒体字段快速定位" data-ui="media-editor-section-nav" className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-sm)] backdrop-blur">
        {[
          ['slots', '图片槽位'],
          ['image', '图片处理'],
          ['video', '商品视频'],
          ['library', '素材库'],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => jumpTo(id)} className="rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-[var(--color-bg)]" style={{ color: 'var(--color-fg)' }}>
            {label}
          </button>
        ))}
      </nav>
      <SellerImageEditorWorkbench
        product={product || null}
        productImageAssets={productImageAssets}
        imageOptions={imageOptions}
        setImageOptions={setImageOptions}
        onUseSourceImage={runSourceImageEdit}
        onUploadSlotImage={uploadSlotImage}
        onSaveImageSlotPlan={saveImageSlotPlan}
        loading={loading}
      />
      <ListingMediaSlotBoard product={product || null} productImageAssets={productImageAssets} productVideoAssets={productVideoAssets} onUseSourceImage={runSourceImageEdit} loading={loading} />

      <section aria-label="素材商品上下文" className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {product?.image_url ? (
          <img src={productImageSrc(product.image_url)} alt={product.product_name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg text-xs" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>未选商品</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" style={{ color: 'var(--color-fg)' }}>{product?.product_name || '请先在内容商品队列选择商品'}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{product ? `${product.target_platform || '平台待补'} / ${product.target_market || '市场待补'} · ${product.lifecycle_label}` : '素材处理必须绑定具体商品，避免图片和 Listing 脱节。'}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {(product?.platform_requirements?.media || []).slice(0, 4).map(item => <span key={item} className="rounded-full px-2 py-1" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>{item}</span>)}
          </div>
        </div>
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {mode !== 'video' && <section id="listing-media-image" aria-label="图片处理参数表" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-[var(--color-primary)]" />
              <h3 className="font-semibold text-[var(--color-fg)]">商品图处理</h3>
            </div>
            <input type="file" accept="image/*" className={inputClass} onChange={event => setImageFile(event.target.files?.[0] || null)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="宽度" value={imageOptions.width} onChange={width => setImageOptions({...imageOptions, width})} />
              <NumberField label="高度" value={imageOptions.height} onChange={height => setImageOptions({...imageOptions, height})} />
              <SelectField label="适配" value={imageOptions.fit} options={[['contain', '完整留白'], ['cover', '居中裁切']]} onChange={fit => setImageOptions({...imageOptions, fit})} />
              <SelectField label="格式" value={imageOptions.output_format} options={[['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP']]} onChange={output_format => setImageOptions({...imageOptions, output_format})} />
              <SelectField label="旋转" value={String(imageOptions.rotate_degrees)} options={[['0', '不旋转'], ['90', '右转90°'], ['180', '旋转180°'], ['270', '右转270°']]} onChange={rotate_degrees => setImageOptions({...imageOptions, rotate_degrees: Number(rotate_degrees)})} />
              <RangeField label="亮度" value={imageOptions.brightness} min={0.5} max={1.5} step={0.05} onChange={brightness => setImageOptions({...imageOptions, brightness})} />
              <RangeField label="对比度" value={imageOptions.contrast} min={0.5} max={1.5} step={0.05} onChange={contrast => setImageOptions({...imageOptions, contrast})} />
	              <RangeField label="锐化" value={imageOptions.sharpness} min={0} max={3} step={0.1} onChange={sharpness => setImageOptions({...imageOptions, sharpness})} />
	              <SelectField label="背景色" value={imageOptions.background} options={[['white', '白色'], ['black', '黑色']]} onChange={background => setImageOptions({...imageOptions, background})} />
	            </div>
	            <div aria-label="图片裁剪参数表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
	              <div className="mb-3 flex items-center justify-between gap-2">
	                <p className="text-xs font-semibold text-[var(--color-fg)]">裁剪区域</p>
	                <SelectField label="模式" value={imageOptions.crop_mode} options={[['none', '不裁剪'], ['manual', '手动裁剪']]} onChange={crop_mode => setImageOptions({...imageOptions, crop_mode})} />
	              </div>
	              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
	                <NumberField label="X" value={imageOptions.crop_x} onChange={crop_x => setImageOptions({...imageOptions, crop_x})} />
	                <NumberField label="Y" value={imageOptions.crop_y} onChange={crop_y => setImageOptions({...imageOptions, crop_y})} />
	                <NumberField label="裁剪宽" value={imageOptions.crop_width} onChange={crop_width => setImageOptions({...imageOptions, crop_width})} />
	                <NumberField label="裁剪高" value={imageOptions.crop_height} onChange={crop_height => setImageOptions({...imageOptions, crop_height})} />
	              </div>
	            </div>
	            <div aria-label="图片水印参数表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
	              <p className="mb-3 text-xs font-semibold text-[var(--color-fg)]">水印</p>
	              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
	                <label className="text-xs text-[var(--color-muted)]">水印文字<input className={`${inputClass} mt-1 block w-full`} value={imageOptions.watermark_text} maxLength={40} onChange={event => setImageOptions({...imageOptions, watermark_text: event.target.value})} placeholder="不填则不添加水印" /></label>
	                <SelectField label="位置" value={imageOptions.watermark_position} options={[['bottom_right', '右下'], ['bottom_left', '左下'], ['top_right', '右上'], ['top_left', '左上'], ['center', '居中']]} onChange={watermark_position => setImageOptions({...imageOptions, watermark_position})} />
	                <RangeField label="透明度" value={imageOptions.watermark_opacity} min={0.05} max={0.8} step={0.05} onChange={watermark_opacity => setImageOptions({...imageOptions, watermark_opacity})} />
	                <label className="text-xs text-[var(--color-muted)]">颜色<input className={`${inputClass} mt-1 block w-full`} value={imageOptions.watermark_color} onChange={event => setImageOptions({...imageOptions, watermark_color: event.target.value})} placeholder="#FFFFFF" /></label>
	              </div>
	            </div>
	            <div className="flex gap-4 text-xs text-[var(--color-muted)]">
              <label><input type="checkbox" checked={imageOptions.auto_contrast} onChange={event => setImageOptions({...imageOptions, auto_contrast: event.target.checked})} /> 自动对比度</label>
              <label><input type="checkbox" checked={imageOptions.unsharp_mask} onChange={event => setImageOptions({...imageOptions, unsharp_mask: event.target.checked})} /> 清晰度增强</label>
              <label><input type="checkbox" checked={imageOptions.flip_horizontal} onChange={event => setImageOptions({...imageOptions, flip_horizontal: event.target.checked})} /> 水平翻转</label>
              <label><input type="checkbox" checked={imageOptions.flip_vertical} onChange={event => setImageOptions({...imageOptions, flip_vertical: event.target.checked})} /> 垂直翻转</label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runSourceImageEdit} disabled={!product?.image_url || loading}><SlidersHorizontal className="w-4 h-4 mr-1" />使用当前商品源图处理</Button>
              <Button onClick={runImageEdit} disabled={!imageFile || loading} variant="outline"><SlidersHorizontal className="w-4 h-4 mr-1" />处理上传图片</Button>
            </div>
          </div>
        </section>}

        {mode !== 'image' && <section id="listing-media-video" aria-label="视频素材编辑区" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[var(--color-danger)]" />
              <h3 className="font-semibold text-[var(--color-fg)]">商品视频</h3>
            </div>
            <input type="file" accept="image/*" multiple className={inputClass} onChange={event => setVideoFiles(Array.from(event.target.files || []))} />
            <p className="text-xs text-[var(--color-muted)]">按选择顺序将 1-20 张图片渲染为无声 MP4，不会补充虚构画面。</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="视频宽度" value={videoOptions.width} onChange={width => setVideoOptions({...videoOptions, width})} />
              <NumberField label="视频高度" value={videoOptions.height} onChange={height => setVideoOptions({...videoOptions, height})} />
              <NumberField label="每张图秒数" value={videoOptions.seconds_per_image} step={0.5} onChange={seconds_per_image => setVideoOptions({...videoOptions, seconds_per_image})} />
              <SelectField label="适配" value={videoOptions.fit} options={[['contain', '完整留白'], ['cover', '居中裁切']]} onChange={fit => setVideoOptions({...videoOptions, fit})} />
            </div>
            <Button onClick={runVideoRender} disabled={videoFiles.length === 0 || loading}><Film className="w-4 h-4 mr-1" />生成 MP4</Button>
          </div>
        </section>}
      </div>

      <Card id="listing-media-library" aria-label="当前商品素材库">
        <CardContent className="pt-4">
          <EvidenceBanner evidence={evidence} compact />
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--color-fg)]">当前商品素材库</h3>
            <Button size="sm" variant="outline" onClick={loadAssets}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
          {assets.length === 0 ? <p className="text-sm text-[var(--color-muted)] py-6 text-center">暂无当前商品素材</p> : (
            <div className="divide-y divide-[var(--color-border)]">
              {assets.map(asset => (
                <div key={asset.id} className="flex items-center gap-3 py-3 text-sm">
                  {asset.asset_type === 'video' ? <Film className="w-4 h-4 text-[var(--color-danger)]" /> : <Image className="w-4 h-4 text-[var(--color-primary)]" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[var(--color-fg)]">{asset.original_name || '商品图视频'}</p>
                    <p className="text-xs text-[var(--color-muted)]">{asset.width} × {asset.height} · {(asset.size_bytes / 1024 / 1024).toFixed(2)} MB{asset.duration_seconds ? ` · ${asset.duration_seconds} 秒` : ''}</p>
                  </div>
                  <button title="下载素材" onClick={() => download(asset)} className="p-1.5 text-[var(--color-primary)]"><Download className="w-4 h-4" /></button>
                  <button title="删除素材" onClick={() => remove(asset)} className="p-1.5 text-[var(--color-danger)]"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function LegacySellerImageEditorWorkbench({
  product,
  productImageAssets,
  imageOptions,
  setImageOptions,
  onUseSourceImage,
  onSaveImageSlotPlan,
  loading,
}: {
  product: ContentWorkbenchItem | null
  productImageAssets: ContentAsset[]
  imageOptions: ImageEditOptions
  setImageOptions: Dispatch<SetStateAction<ImageEditOptions>>
  onUseSourceImage: () => void
  onSaveImageSlotPlan: (slots: MediaSlotPlan[]) => void
  loading: boolean
}) {
  const [activeSlotIndex, setActiveSlotIndex] = useState(1)
  const [activeTool, setActiveTool] = useState('修改尺寸')
  const [draggingSlotIndex, setDraggingSlotIndex] = useState<number | null>(null)
  const sourceImage = product?.image_url || ''
  const slotCount = Math.max(product?.media_readiness?.recommended_platform_images ?? 9, 9)
  const imageAssetKey = productImageAssets.map(asset => `${asset.id}:${asset.created_at}`).join('|')
  const [imageSlots, setImageSlots] = useState<MediaSlotPlan[]>([])
  useEffect(() => {
    const nextSlots = Array.from({ length: slotCount }).map((_, index) => {
      const asset = productImageAssets[index - 1]
      const imageUrl = index === 0 ? sourceImage : asset?.extra?.url ? String(asset.extra.url) : ''
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
    return {
      ...slot,
      index: index + 1,
      role: roleMeta.role,
      label: roleMeta.label,
    }
  })
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
  const filterStyle = {
    filter: `brightness(${imageOptions.brightness}) contrast(${imageOptions.contrast})`,
  }
  const applyToolPreset = (tool: string) => {
    setActiveTool(tool)
    if (tool === '裁剪旋转') {
      setImageOptions(prev => ({ ...prev, fit: 'cover', crop_mode: 'manual', crop_width: prev.width, crop_height: prev.height }))
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
  const toolGroups = [
    { title: '调整', tools: ['消除笔', '裁剪旋转', '修改尺寸', '图片翻译', 'AI设计'] },
    { title: '更多工具', tools: ['智能抠图', '图片变清晰', '拼图', '切图', '商品堆品', '图片校正'] },
    { title: '标记工具', tools: ['涂鸦', '形状线条', '商品标尺', '放大镜'] },
  ]
  const editableToolHints: Record<string, string> = {
    消除笔: '当前先记录为图片处理任务，后续接入局部涂抹/擦除组件。',
    裁剪旋转: '切换完整留白/居中裁切，保存后由后端重新生成平台尺寸图。',
    修改尺寸: '设置为平台常用 800×800 方图。',
    图片翻译: '当前先作为待处理任务，避免伪造翻译结果。',
    AI设计: '当前先作为待处理任务，后续接入可用 AI 图像组件。',
    智能抠图: '输出 PNG 白底图，用于主图白底规范。',
    图片变清晰: '提升锐化、对比度和自动对比度。',
    拼图: '生成 1080×1080 留白图，适合多图拼版前置。',
    切图: '设置居中裁切方图，用于平台缩略图。',
    商品堆品: '当前先作为待处理任务，避免生成假商品组合图。',
    图片校正: '轻微提升亮度和对比度。',
    涂鸦: '当前先作为待处理任务，后续接入标注画笔。',
    形状线条: '当前先作为待处理任务，后续接入标注图形。',
    商品标尺: '当前先作为待处理任务，后续接入尺寸标注。',
    放大镜: '当前先作为待处理任务，后续接入细节放大组件。',
  }

  return (
    <section aria-label="Listing 图片编辑工作台" data-ui="listing-image-editor-workbench" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary-light)] px-4 py-2 text-xs">
        <span className="font-semibold text-[var(--color-primary)]">当前已开启批量编辑模式</span>
        <Badge variant="success">批量编辑模式</Badge>
      </div>
      <div className="grid min-h-[560px] grid-cols-1 2xl:grid-cols-[220px_minmax(640px,1fr)_150px]">
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
            <div className="grid h-[420px] w-full max-w-[720px] place-items-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] text-center text-sm text-[var(--color-muted)]">
              <div>
                <Image className="mx-auto mb-3 h-10 w-10" />
                <p>当前商品缺少可编辑主图</p>
                <p className="mt-1 text-xs">请先采集或上传真实图片，不使用假图占位。</p>
              </div>
            </div>
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
          </div>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Button variant="outline" disabled={!product}>取消</Button>
            <Button onClick={onUseSourceImage} disabled={!sourceImage || loading}>{loading ? '处理中...' : '保存图片修改'}</Button>
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
            >
              <span>
                <Plus className="mx-auto mb-1 h-4 w-4" />
                新增图片空位
              </span>
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function ListingMediaSlotBoard({ product, productImageAssets, productVideoAssets, onUseSourceImage, loading }: {
  product: ContentWorkbenchItem | null
  productImageAssets: ContentAsset[]
  productVideoAssets: ContentAsset[]
  onUseSourceImage: () => void
  loading: boolean
}) {
  const media = product?.media_readiness
  const captured = media?.captured_image_count ?? (product?.image_url ? 1 : 0)
  const minImages = media?.min_platform_images ?? 5
  const recommendedImages = media?.recommended_platform_images ?? 9
  const missing = Math.max(0, minImages - captured)
  const mediaGaps = media?.gaps || []
  const slotCount = Math.max(recommendedImages, minImages, 5)
  const sourceImageUsed = Boolean(product?.image_url)
  const imageSlots = Array.from({ length: slotCount }).map((_, index) => {
    const slotNo = index + 1
    const processedAsset = productImageAssets[index - 1]
    const isMain = index === 0
    const hasKnownImage = isMain ? sourceImageUsed : captured > index
    return {
      id: `slot-${slotNo}`,
      label: isMain ? '主图' : `辅图 ${index}`,
      role: isMain ? '搜索页首图 / 商品页主图' : slotNo <= 5 ? '核心卖点辅图' : '场景/尺寸/细节补充',
      imageUrl: isMain ? product?.image_url : null,
      status: hasKnownImage ? processedAsset ? '已处理素材' : '已采集未预览' : slotNo <= minImages ? '必补图片' : '建议补充',
      assetLabel: processedAsset?.original_name || '',
      required: slotNo <= minImages,
    }
  })

  return (
    <section id="listing-media-slots" aria-label="Listing 图片槽位工作台" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 媒体素材</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">平台图片槽位与素材门禁</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">
              按电商后台的主图、辅图、视频素材来管理当前商品；没有真实图片 URL 的位置只显示槽位状态，不使用假图替代。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={missing === 0 ? 'success' : 'warning'}>图片 {captured}/{minImages}</Badge>
            <Badge variant={productVideoAssets.length ? 'success' : 'default'}>视频素材 {productVideoAssets.length}</Badge>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MediaHealthCard label="最低图片" value={`${minImages} 张`} detail="发布基础门槛" />
          <MediaHealthCard label="建议图片" value={`${recommendedImages} 张`} detail="覆盖卖点、场景、尺寸、细节" />
          <MediaHealthCard label="当前缺口" value={missing ? `${missing} 张` : '已达标'} detail={mediaGaps[0] || '数量基础达标，继续检查图片质量'} warning={missing > 0 || mediaGaps.length > 0} />
          <MediaHealthCard label="处理素材" value={`${productImageAssets.length} 图 / ${productVideoAssets.length} 视频`} detail="仅统计绑定当前商品的素材" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4">
          <div className="mb-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table aria-label="卖家后台图片槽位主表" className="w-full text-left text-xs">
              <thead className="bg-[var(--color-bg)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">槽位</th>
                  <th className="px-3 py-2 font-medium">图片角色</th>
                  <th className="px-3 py-2 font-medium">素材状态</th>
                  <th className="px-3 py-2 font-medium">处理动作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {imageSlots.map(slot => (
                  <tr key={slot.id} className="text-[var(--color-fg)]">
                    <td className="px-3 py-2 font-medium">{slot.label}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{slot.role}</td>
                    <td className="px-3 py-2">{slot.status}</td>
                    <td className="px-3 py-2 text-[var(--color-primary)]">{slot.required ? '必须补齐/处理' : '可补充优化'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {imageSlots.map(slot => (
              <div key={slot.id} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div className="relative">
                  {slot.imageUrl ? (
                    <img src={productImageSrc(slot.imageUrl)} alt={`${product?.product_name || '商品'}${slot.label}`} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center bg-[var(--color-surface)] text-xs text-[var(--color-muted)]">
                      {slot.required ? '待补真实图片' : '建议补图'}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-[var(--color-surface)]/95 px-2 py-1 text-[11px] font-medium text-[var(--color-fg)] shadow-[var(--shadow-sm)]">{slot.label}</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--color-fg)]">{slot.status}</p>
                    {slot.required && <span className="rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[10px] text-[var(--color-warning)]">必需</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--color-muted)]">{slot.assetLabel || slot.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <section aria-label="Listing 图片处理动作" className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs font-semibold text-[var(--color-fg)]">图片处理动作</p>
          <div className="mt-3 grid gap-2 text-xs text-[var(--color-muted)]">
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">主图优先处理为 1:1 白底或干净背景，避免文字、水印和无关拼贴。</p>
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">辅图覆盖细节、尺寸、使用场景、包装配件和卖点对比。</p>
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">短视频素材用于 TikTok Shop 和内容分发，不替代主图数量要求。</p>
          </div>
          <Button className="mt-4 w-full" onClick={onUseSourceImage} disabled={!product?.image_url || loading}>
            <SlidersHorizontal className="mr-1 h-4 w-4" />处理当前主图
          </Button>
        </section>
      </div>
    </section>
  )
}

function MediaHealthCard({ label, value, detail, warning }: { label: string; value: string; detail: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-[var(--color-warning)]' : 'mt-1 text-sm font-semibold text-[var(--color-fg)]'}>{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}<input type="number" min="0" step={step} className={`${inputClass} block w-full mt-1`} value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}：{value}<input type="range" className="block w-full mt-2" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}<select className={`${inputClass} block w-full mt-1`} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option[0]} value={option[0]}>{option[1]}</option>)}</select></label>
}
