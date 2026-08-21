import { Download, Film, Image, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import type { ContentAsset, ContentWorkbenchItem } from '../../api/content'
import { productImageSrc } from '../../utils/productImages'
import type { ImageEditOptions, ImageWatermarkTemplateOption } from './SellerImageEditorWorkbench'

type VideoOptions = {
  width: number
  height: number
  fit: string
  background: string
  seconds_per_image: number
}

const inputClass = 'text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]'

export function MediaStudioSectionNav({ onJump }: { onJump: (id: string) => void }) {
  return (
    <nav aria-label="Listing 媒体字段快速定位" data-ui="media-editor-section-nav" className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-2 shadow-[var(--shadow-sm)] backdrop-blur">
      {[
        ['slots', '图片槽位'],
        ['image', '图片处理'],
        ['video', '商品视频'],
        ['library', '素材库'],
      ].map(([id, label]) => (
        <button key={id} type="button" onClick={() => onJump(id)} className="rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-[var(--color-bg)]" style={{ color: 'var(--color-fg)' }}>
          {label}
        </button>
      ))}
    </nav>
  )
}

export function MediaProductContextPanel({
  product,
  loading,
  onRunSavedImageExportTasks,
}: {
  product: ContentWorkbenchItem | null
  loading: boolean
  onRunSavedImageExportTasks: () => void
}) {
  return (
    <section aria-label="素材商品上下文" data-ui="content-image-plan-refresh-after-save" className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
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
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="secondary"
          disabled={!product || loading}
          onClick={onRunSavedImageExportTasks}
          data-ui="content-image-export-task-execute-button"
        >
          <Download className="mr-1 h-4 w-4" />
          执行已保存导出任务
        </Button>
      </div>
    </section>
  )
}

export function ImageProcessingPanel({
  product,
  loading,
  imageFile,
  imageOptions,
  watermarkTemplates,
  onImageFileChange,
  onImageOptionsChange,
  onApplyWatermarkTemplate,
  onClearWatermark,
  onRunSourceImageEdit,
  onRunImageEdit,
}: {
  product: ContentWorkbenchItem | null
  loading: boolean
  imageFile: File | null
  imageOptions: ImageEditOptions
  watermarkTemplates: ImageWatermarkTemplateOption[]
  onImageFileChange: (file: File | null) => void
  onImageOptionsChange: (value: ImageEditOptions) => void
  onApplyWatermarkTemplate: (template: ImageWatermarkTemplateOption) => void
  onClearWatermark: () => void
  onRunSourceImageEdit: () => void
  onRunImageEdit: () => void
}) {
  return (
    <section id="listing-media-image" aria-label="图片处理参数表" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="font-semibold text-[var(--color-fg)]">商品图处理</h3>
        </div>
        <input type="file" accept="image/*" className={inputClass} onChange={event => onImageFileChange(event.target.files?.[0] || null)} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="宽度" value={imageOptions.width} onChange={width => onImageOptionsChange({ ...imageOptions, width })} />
          <NumberField label="高度" value={imageOptions.height} onChange={height => onImageOptionsChange({ ...imageOptions, height })} />
          <SelectField label="适配" value={imageOptions.fit} options={[['contain', '完整留白'], ['cover', '居中裁切']]} onChange={fit => onImageOptionsChange({ ...imageOptions, fit })} />
          <SelectField label="格式" value={imageOptions.output_format} options={[['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP']]} onChange={output_format => onImageOptionsChange({ ...imageOptions, output_format })} />
          <SelectField label="旋转" value={String(imageOptions.rotate_degrees)} options={[['0', '不旋转'], ['90', '右转90°'], ['180', '旋转180°'], ['270', '右转270°']]} onChange={rotate_degrees => onImageOptionsChange({ ...imageOptions, rotate_degrees: Number(rotate_degrees) })} />
          <RangeField label="亮度" value={imageOptions.brightness} min={0.5} max={1.5} step={0.05} onChange={brightness => onImageOptionsChange({ ...imageOptions, brightness })} />
          <RangeField label="对比度" value={imageOptions.contrast} min={0.5} max={1.5} step={0.05} onChange={contrast => onImageOptionsChange({ ...imageOptions, contrast })} />
          <RangeField label="锐化" value={imageOptions.sharpness} min={0} max={3} step={0.1} onChange={sharpness => onImageOptionsChange({ ...imageOptions, sharpness })} />
          <SelectField label="背景色" value={imageOptions.background} options={[['white', '白色'], ['black', '黑色']]} onChange={background => onImageOptionsChange({ ...imageOptions, background })} />
        </div>
        <div aria-label="图片裁剪参数表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--color-fg)]">裁剪区域</p>
            <SelectField label="模式" value={imageOptions.crop_mode} options={[['none', '不裁剪'], ['manual', '手动裁剪']]} onChange={crop_mode => onImageOptionsChange({ ...imageOptions, crop_mode })} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <NumberField label="X" value={imageOptions.crop_x} onChange={crop_x => onImageOptionsChange({ ...imageOptions, crop_x })} />
            <NumberField label="Y" value={imageOptions.crop_y} onChange={crop_y => onImageOptionsChange({ ...imageOptions, crop_y })} />
            <NumberField label="裁剪宽" value={imageOptions.crop_width} onChange={crop_width => onImageOptionsChange({ ...imageOptions, crop_width })} />
            <NumberField label="裁剪高" value={imageOptions.crop_height} onChange={crop_height => onImageOptionsChange({ ...imageOptions, crop_height })} />
          </div>
        </div>
        <ImageWatermarkOptions
          imageOptions={imageOptions}
          watermarkTemplates={watermarkTemplates}
          onImageOptionsChange={onImageOptionsChange}
          onApplyWatermarkTemplate={onApplyWatermarkTemplate}
          onClearWatermark={onClearWatermark}
        />
        <div className="flex gap-4 text-xs text-[var(--color-muted)]">
          <label><input type="checkbox" checked={imageOptions.auto_contrast} onChange={event => onImageOptionsChange({ ...imageOptions, auto_contrast: event.target.checked })} /> 自动对比度</label>
          <label><input type="checkbox" checked={imageOptions.unsharp_mask} onChange={event => onImageOptionsChange({ ...imageOptions, unsharp_mask: event.target.checked })} /> 清晰度增强</label>
          <label><input type="checkbox" checked={imageOptions.flip_horizontal} onChange={event => onImageOptionsChange({ ...imageOptions, flip_horizontal: event.target.checked })} /> 水平翻转</label>
          <label><input type="checkbox" checked={imageOptions.flip_vertical} onChange={event => onImageOptionsChange({ ...imageOptions, flip_vertical: event.target.checked })} /> 垂直翻转</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRunSourceImageEdit} disabled={!product?.image_url || loading}><SlidersHorizontal className="w-4 h-4 mr-1" />使用当前商品源图处理</Button>
          <Button onClick={onRunImageEdit} disabled={!imageFile || loading} variant="outline"><SlidersHorizontal className="w-4 h-4 mr-1" />处理上传图片</Button>
        </div>
      </div>
    </section>
  )
}

export function VideoProcessingPanel({
  videoFiles,
  videoOptions,
  loading,
  onVideoFilesChange,
  onVideoOptionsChange,
  onRunVideoRender,
}: {
  videoFiles: File[]
  videoOptions: VideoOptions
  loading: boolean
  onVideoFilesChange: (files: File[]) => void
  onVideoOptionsChange: (value: VideoOptions) => void
  onRunVideoRender: () => void
}) {
  return (
    <section id="listing-media-video" aria-label="视频素材编辑区" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[var(--color-danger)]" />
          <h3 className="font-semibold text-[var(--color-fg)]">商品视频</h3>
        </div>
        <input type="file" accept="image/*" multiple className={inputClass} onChange={event => onVideoFilesChange(Array.from(event.target.files || []))} />
        <p className="text-xs text-[var(--color-muted)]">按选择顺序将 1-20 张图片渲染为无声 MP4，不会补充虚构画面。</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="视频宽度" value={videoOptions.width} onChange={width => onVideoOptionsChange({ ...videoOptions, width })} />
          <NumberField label="视频高度" value={videoOptions.height} onChange={height => onVideoOptionsChange({ ...videoOptions, height })} />
          <NumberField label="每张图秒数" value={videoOptions.seconds_per_image} step={0.5} onChange={seconds_per_image => onVideoOptionsChange({ ...videoOptions, seconds_per_image })} />
          <SelectField label="适配" value={videoOptions.fit} options={[['contain', '完整留白'], ['cover', '居中裁切']]} onChange={fit => onVideoOptionsChange({ ...videoOptions, fit })} />
        </div>
        <Button onClick={onRunVideoRender} disabled={videoFiles.length === 0 || loading}><Film className="w-4 h-4 mr-1" />生成 MP4</Button>
      </div>
    </section>
  )
}

export function ContentAssetLibraryPanel({
  assets,
  evidence,
  onRefresh,
  onDownload,
  onRemove,
}: {
  assets: ContentAsset[]
  evidence: ApiResponse<ContentAsset[]> | null
  onRefresh: () => void
  onDownload: (asset: ContentAsset) => void
  onRemove: (asset: ContentAsset) => void
}) {
  return (
    <Card id="listing-media-library" aria-label="当前商品素材库">
      <CardContent className="pt-4">
        <EvidenceBanner evidence={evidence} compact />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[var(--color-fg)]">当前商品素材库</h3>
          <Button size="sm" variant="outline" onClick={onRefresh}><RefreshCw className="w-3.5 h-3.5" /></Button>
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
                <button title="下载素材" onClick={() => onDownload(asset)} className="p-1.5 text-[var(--color-primary)]"><Download className="w-4 h-4" /></button>
                <button title="删除素材" onClick={() => onRemove(asset)} className="p-1.5 text-[var(--color-danger)]"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ListingMediaSlotBoard({ product, productImageAssets, productVideoAssets, onUseSourceImage, loading }: {
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
      status: hasKnownImage ? processedAsset ? '已处理素材' : '已采集未预览' : slotNo <= minImages ? '必补发布图' : '建议补充',
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
          <MediaHealthCard label="最低发布图" value={`${minImages} 张`} detail="发布基础门槛" />
          <MediaHealthCard label="建议发布图" value={`${recommendedImages} 张`} detail="覆盖卖点、场景、尺寸、细节" />
          <MediaHealthCard label="发布图缺口" value={missing ? `${missing} 张` : '发布图已达标'} detail={mediaGaps[0] || '发布图数量基础达标，继续检查图片质量'} warning={missing > 0 || mediaGaps.length > 0} />
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

function ImageWatermarkOptions({
  imageOptions,
  watermarkTemplates,
  onImageOptionsChange,
  onApplyWatermarkTemplate,
  onClearWatermark,
}: {
  imageOptions: ImageEditOptions
  watermarkTemplates: ImageWatermarkTemplateOption[]
  onImageOptionsChange: (value: ImageEditOptions) => void
  onApplyWatermarkTemplate: (template: ImageWatermarkTemplateOption) => void
  onClearWatermark: () => void
}) {
  return (
    <div aria-label="图片水印参数表" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">水印</p>
        <div className="flex flex-wrap gap-2" data-ui="content-image-watermark-template-picker">
          {watermarkTemplates.slice(0, 4).map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => onApplyWatermarkTemplate(template)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
            >
              应用水印模板：{template.name}
            </button>
          ))}
          <button
            type="button"
            onClick={onClearWatermark}
            disabled={!imageOptions.watermark_text}
            className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除水印
          </button>
        </div>
      </div>
      {watermarkTemplates.length === 0 && <p className="mb-3 text-[11px] text-[var(--color-muted)]">暂无水印模板；请先到图片/水印模板维护真实模板后再应用。</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-[var(--color-muted)]">水印文字<input className={`${inputClass} mt-1 block w-full`} value={imageOptions.watermark_text} maxLength={40} onChange={event => onImageOptionsChange({ ...imageOptions, watermark_text: event.target.value })} placeholder="不填则不添加水印" /></label>
        <SelectField label="位置" value={imageOptions.watermark_position} options={[['bottom_right', '右下'], ['bottom_left', '左下'], ['top_right', '右上'], ['top_left', '左上'], ['center', '居中']]} onChange={watermark_position => onImageOptionsChange({ ...imageOptions, watermark_position })} />
        <RangeField label="透明度" value={imageOptions.watermark_opacity} min={0.05} max={0.8} step={0.05} onChange={watermark_opacity => onImageOptionsChange({ ...imageOptions, watermark_opacity })} />
        <label className="text-xs text-[var(--color-muted)]">颜色<input className={`${inputClass} mt-1 block w-full`} value={imageOptions.watermark_color} onChange={event => onImageOptionsChange({ ...imageOptions, watermark_color: event.target.value })} placeholder="#FFFFFF" /></label>
      </div>
    </div>
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
