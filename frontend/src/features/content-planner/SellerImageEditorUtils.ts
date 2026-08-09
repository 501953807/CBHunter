import type { ContentAsset } from '../../api/content'
import type { ImageEditOptions } from './SellerImageEditorWorkbench'

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
