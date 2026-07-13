import { useEffect, useState } from 'react'
import { Download, Film, Image, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import {
  deleteContentAsset,
  downloadContentAsset,
  editContentImage,
  editContentImageFromUrl,
  getContentAssets,
  renderContentVideo,
  type ContentAsset,
  type ContentWorkbenchItem,
} from '../../api/content'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'

const inputClass = 'text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]'

export function ContentMediaStudio({ mode = 'all', product }: { mode?: 'all' | 'image' | 'video'; product?: ContentWorkbenchItem | null }) {
  const toast = useToast()
  const confirmAction = useConfirm()
  const [assets, setAssets] = useState<ContentAsset[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<ContentAsset[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFiles, setVideoFiles] = useState<File[]>([])
  const [imageOptions, setImageOptions] = useState({
    width: 1080, height: 1080, fit: 'contain', background: 'white',
    brightness: 1, contrast: 1, sharpness: 1, auto_contrast: true,
    unsharp_mask: true, output_format: 'jpeg', quality: 88,
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
      const response = await editContentImage(imageFile, imageOptions)
      toast.addToast('success', `图片已处理：${response.data?.width} × ${response.data?.height}`)
      await loadAssets()
    } catch (error: any) {
      logger.error('Edit content image failed', error)
      toast.addToast('error', error?.response?.data?.detail || '图片处理失败')
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

  return (
    <div className="space-y-4">
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
        {mode !== 'video' && <Card>
          <CardContent className="pt-4 space-y-4">
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
              <RangeField label="亮度" value={imageOptions.brightness} min={0.5} max={1.5} step={0.05} onChange={brightness => setImageOptions({...imageOptions, brightness})} />
              <RangeField label="对比度" value={imageOptions.contrast} min={0.5} max={1.5} step={0.05} onChange={contrast => setImageOptions({...imageOptions, contrast})} />
              <RangeField label="锐化" value={imageOptions.sharpness} min={0} max={3} step={0.1} onChange={sharpness => setImageOptions({...imageOptions, sharpness})} />
              <SelectField label="背景色" value={imageOptions.background} options={[['white', '白色'], ['black', '黑色']]} onChange={background => setImageOptions({...imageOptions, background})} />
            </div>
            <div className="flex gap-4 text-xs text-[var(--color-muted)]">
              <label><input type="checkbox" checked={imageOptions.auto_contrast} onChange={event => setImageOptions({...imageOptions, auto_contrast: event.target.checked})} /> 自动对比度</label>
              <label><input type="checkbox" checked={imageOptions.unsharp_mask} onChange={event => setImageOptions({...imageOptions, unsharp_mask: event.target.checked})} /> 清晰度增强</label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runSourceImageEdit} disabled={!product?.image_url || loading}><SlidersHorizontal className="w-4 h-4 mr-1" />使用当前商品源图处理</Button>
              <Button onClick={runImageEdit} disabled={!imageFile || loading} variant="outline"><SlidersHorizontal className="w-4 h-4 mr-1" />处理上传图片</Button>
            </div>
          </CardContent>
        </Card>}

        {mode !== 'image' && <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[var(--color-danger)]" />
              <h3 className="font-semibold text-[var(--color-fg)]">商品图转视频</h3>
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
          </CardContent>
        </Card>}
      </div>

      <Card>
        <CardContent className="pt-4">
          <EvidenceBanner evidence={evidence} compact />
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--color-fg)]">已生成素材</h3>
            <Button size="sm" variant="outline" onClick={loadAssets}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
          {assets.length === 0 ? <p className="text-sm text-[var(--color-muted)] py-6 text-center">暂无已生成素材</p> : (
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

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}<input type="number" min="0" step={step} className={`${inputClass} block w-full mt-1`} value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}

function RangeField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}：{value}<input type="range" className="block w-full mt-2" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="text-xs text-[var(--color-muted)]">{label}<select className={`${inputClass} block w-full mt-1`} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option[0]} value={option[0]}>{option[1]}</option>)}</select></label>
}
