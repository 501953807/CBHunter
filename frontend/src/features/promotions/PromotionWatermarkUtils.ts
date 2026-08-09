export type PromotionWatermarkFormFields = {
  watermarkTemplateId: string
  watermarkScope: string
}

export type PromotionWatermarkSelection = {
  templateId: string
  scope: string
}

export function buildMarketingWatermark(form: PromotionWatermarkFormFields) {
  return {
    binding_schema: 'promotion_watermark_binding.v1',
    watermark_template_id: form.watermarkTemplateId.trim() || null,
    watermark_scope: form.watermarkScope || 'first_main_image',
    application_state: form.watermarkTemplateId.trim() ? 'local_watermark_not_applied' : 'watermark_template_not_selected',
  }
}

export function marketingWatermarkToForm(value: unknown): Partial<PromotionWatermarkFormFields> {
  const watermark = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    watermarkTemplateId: String(watermark.watermark_template_id || ''),
    watermarkScope: String(watermark.watermark_scope || 'first_main_image'),
  }
}

export function marketingWatermarkSummary(value: unknown) {
  const watermark = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  if (!watermark.watermark_template_id) return '营销水印模板待选择'
  const scope = watermark.watermark_scope === 'all_publish_images' ? '全部发布图' : watermark.watermark_scope === 'promotion_images_only' ? '活动素材图' : '首张主图'
  const state = watermark.application_state === 'local_watermark_not_applied' ? '本地已关联，待图片工作台应用' : String(watermark.application_state || '待应用')
  return `营销水印：${scope} · ${state}`
}
