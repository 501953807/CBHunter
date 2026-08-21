import { logger } from '../../utils/logger'
import { listingImageRoleByIndex } from './SellerImageEditorUtils'
import type { ImageEditOptions, MediaSlotPlan } from './SellerImageEditorTypes'

export function parseSavedImageSlotPlan(content: string): MediaSlotPlan[] | null {
  if (!content.trim()) return null
  try {
    const parsed = JSON.parse(content) as { schema?: string; slots?: unknown[]; export_tasks?: unknown[] }
    if (parsed.schema !== 'listing_image_slots.v1' || !Array.isArray(parsed.slots)) return null
    const exportTasksByPosition = buildExportTasksByPosition(parsed.export_tasks)
    const slots = parsed.slots.map((slot, index) => normalizeSavedImageSlot(slot, index, exportTasksByPosition.get(index + 1))).filter(Boolean) as MediaSlotPlan[]
    return slots.length > 0 ? slots : null
  } catch (error: unknown) {
    logger.error('Parse saved image slot plan failed', error)
    return null
  }
}

function normalizeSavedImageSlot(slot: unknown, index: number, exportTask?: Record<string, unknown>): MediaSlotPlan | null {
  if (!slot || typeof slot !== 'object') return null
  const data = slot as Record<string, unknown>
  const roleMeta = listingImageRoleByIndex(index)
  return {
    index: index + 1,
    role: String(data.role || roleMeta.role),
    label: String(data.label || roleMeta.label),
    imageUrl: String(data.image_url || ''),
    assetName: String(data.asset_name || ''),
    sizeText: String(data.size || (data.image_url ? '已保存槽位' : '待补真实图片')),
    publishable: typeof data.publishable === 'boolean' ? data.publishable : undefined,
    editOptions: normalizeSavedImageEditOptions(data.edit_options),
    exportStatus: exportTask ? String(exportTask.status || '') : undefined,
    exportError: exportTask?.error ? String(exportTask.error) : undefined,
    generatedAssetUrl: exportTask?.generated_asset_url ? String(exportTask.generated_asset_url) : undefined,
    exportedAt: exportTask?.executed_at ? String(exportTask.executed_at) : undefined,
  }
}

function buildExportTasksByPosition(value: unknown) {
  const map = new Map<number, Record<string, unknown>>()
  if (!Array.isArray(value)) return map
  value.forEach(task => {
    if (!task || typeof task !== 'object') return
    const data = task as Record<string, unknown>
    const position = Number(data.position || 0)
    if (Number.isFinite(position) && position > 0) map.set(position, data)
  })
  return map
}

function normalizeSavedImageEditOptions(value: unknown): ImageEditOptions | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  return {
    width: Number(data.width || 1080),
    height: Number(data.height || 1080),
    fit: String(data.fit || 'contain'),
    background: String(data.background || 'white'),
    brightness: Number(data.brightness || 1),
    contrast: Number(data.contrast || 1),
    sharpness: Number(data.sharpness || 1),
    auto_contrast: Boolean(data.auto_contrast),
    unsharp_mask: Boolean(data.unsharp_mask),
    crop_mode: String(data.crop_mode || 'none'),
    crop_x: Number(data.crop_x || 0),
    crop_y: Number(data.crop_y || 0),
    crop_width: Number(data.crop_width || 800),
    crop_height: Number(data.crop_height || 800),
    rotate_degrees: Number(data.rotate_degrees || 0),
    flip_horizontal: Boolean(data.flip_horizontal),
    flip_vertical: Boolean(data.flip_vertical),
    watermark_text: String(data.watermark_text || ''),
    watermark_position: String(data.watermark_position || 'bottom_right'),
    watermark_opacity: Number(data.watermark_opacity || 0.32),
    watermark_color: String(data.watermark_color || '#FFFFFF'),
    output_format: String(data.output_format || 'jpeg'),
    quality: Number(data.quality || 88),
  }
}
