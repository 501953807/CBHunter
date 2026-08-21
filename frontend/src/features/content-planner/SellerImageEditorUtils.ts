import type { ContentAsset } from '../../api/content'
import type { ListingTemplate } from '../../api/templates'
import type { ImageEditOptions } from './SellerImageEditorTypes'
import type { ImageWatermarkTemplateOption } from './SellerImageEditorTypes'

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

export const assetImageUrl = (asset: ContentAsset) => {
  const explicitUrl = asset.extra?.url ? String(asset.extra.url) : ''
  return explicitUrl || `/api/v1/content/assets/${asset.id}/file`
}

export const clampImageSlotIndex = (slotIndex: number, slotCount: number) => {
  if (!Number.isFinite(slotIndex)) return 1
  return Math.max(1, Math.min(Math.max(slotCount, 1), Math.floor(slotIndex)))
}

export const buildImageProcessingSummary = (options: ImageEditOptions) => {
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

export const buildCropPreviewStyle = (options: ImageEditOptions) => {
  const baseWidth = Math.max(options.width || 1, 1)
  const baseHeight = Math.max(options.height || 1, 1)
  const left = Math.min(96, Math.max(2, (options.crop_x / baseWidth) * 100))
  const top = Math.min(96, Math.max(2, (options.crop_y / baseHeight) * 100))
  const width = Math.min(96 - left, Math.max(8, ((options.crop_width || baseWidth) / baseWidth) * 100))
  const height = Math.min(96 - top, Math.max(8, ((options.crop_height || baseHeight) / baseHeight) * 100))
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
}

export const buildWatermarkPreviewStyle = (options: ImageEditOptions) => {
  const base = {
    background: 'color-mix(in srgb, var(--color-fg) 55%, transparent)',
    color: options.watermark_color || '#FFFFFF',
    opacity: Math.min(0.8, Math.max(0.05, options.watermark_opacity || 0.32)),
  }
  const positions: Record<string, Record<string, string>> = {
    top_left: { left: '4%', top: '4%' },
    top_right: { right: '4%', top: '4%' },
    bottom_left: { left: '4%', bottom: '4%' },
    bottom_right: { right: '4%', bottom: '4%' },
    center: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  }
  return { ...base, ...(positions[options.watermark_position] || positions.bottom_right) }
}

export const SELLER_IMAGE_TOOL_GROUPS = [
  { title: '调整', tools: ['消除笔', '裁剪旋转', '修改尺寸', '图片翻译', 'AI设计'] },
  { title: '更多工具', tools: ['智能抠图', '图片变清晰', '拼图', '切图', '商品堆品', '图片校正'] },
  { title: '标记工具', tools: ['涂鸦', '形状线条', '商品标尺', '放大镜'] },
]

export const SELLER_IMAGE_TOOL_HINTS: Record<string, string> = {
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

export const SELLER_IMAGE_PLATFORM_SIZE_PRESETS: Array<{
  label: string
  width: number
  height: number
  fit: ImageEditOptions['fit']
}> = [
  { label: 'Shopee/TEMU 方图', width: 800, height: 800, fit: 'cover' },
  { label: 'TikTok 主图', width: 600, height: 600, fit: 'cover' },
  { label: '营销海报', width: 1080, height: 1080, fit: 'contain' },
]

export function isImageWatermarkTemplate(template: ListingTemplate) {
  return template.template_data?.template_type === 'image_watermark'
}

export function toImageWatermarkTemplateOption(template: ListingTemplate): ImageWatermarkTemplateOption {
  const data = template.template_data || {}
  return {
    id: template.id,
    name: template.name,
    platform: template.platform,
    scope: String(data.watermark_scope || 'first_main_image'),
    text: String(data.watermark_text || template.name),
    position: String(data.watermark_position || 'bottom_right'),
    opacity: normalizeWatermarkOpacity(data.watermark_opacity),
    color: String(data.watermark_color || '#FFFFFF'),
  }
}

function normalizeWatermarkOpacity(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0.32
  const ratio = numeric > 1 ? numeric / 100 : numeric
  return Math.min(0.8, Math.max(0.05, ratio))
}
