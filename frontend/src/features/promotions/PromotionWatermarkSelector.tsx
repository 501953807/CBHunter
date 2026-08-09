import { useQuery } from '@tanstack/react-query'
import { listListingTemplates, type ListingTemplate } from '../../api/templates'
import { logger } from '../../utils/logger'
import type { PromotionWatermarkSelection } from './PromotionWatermarkUtils'

const WATERMARK_SCOPE_OPTIONS = [
  { value: 'first_main_image', label: '首张主图' },
  { value: 'all_publish_images', label: '全部发布图' },
  { value: 'promotion_images_only', label: '仅活动素材图' },
]

export function PromotionWatermarkSelector({
  value,
  platform,
  onChange,
}: {
  value: PromotionWatermarkSelection
  platform?: string
  onChange: (value: PromotionWatermarkSelection) => void
}) {
  const query = useQuery({
    queryKey: ['promotion-watermark-templates'],
    queryFn: async () => {
      const result = await listListingTemplates()
      return result.data || []
    },
  })
  const templates = (query.data || []).filter(template => isWatermarkTemplate(template) && isTemplateAvailableForPlatform(template, platform))
  const selectedTemplate = templates.find(template => template.id === value.templateId)

  if (query.error) logger.error('Load promotion watermark templates failed', query.error)

  return (
    <section data-ui="promotion-watermark-activity-linkage" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">营销水印活动化</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            促销活动只关联本地水印模板；真正改图必须进入内容工厂图片工作台应用并导出，不冒充平台营销水印已生效。
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)]">
          模板 {templates.length} 个
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-fg)]">关联水印模板</span>
          <select
            value={value.templateId}
            onChange={(event) => onChange({ ...value, templateId: event.target.value })}
            className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            <option value="">不关联水印模板</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.name} · {template.platform}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-fg)]">应用范围</span>
          <select
            value={value.scope}
            onChange={(event) => onChange({ ...value, scope: event.target.value })}
            className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          >
            {WATERMARK_SCOPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
        {query.isLoading ? '正在读取图片/水印模板。' : selectedTemplate ? (
          <>
            已关联：<span className="font-medium text-[var(--color-fg)]">{selectedTemplate.name}</span>
            <span className="ml-2">位置 {String(selectedTemplate.template_data?.watermark_position || '待配置')} · 透明度 {String(selectedTemplate.template_data?.watermark_opacity || '待配置')}</span>
          </>
        ) : templates.length ? '未选择水印模板，活动不会生成图片处理计划。' : '暂无可用水印模板，请先到产品水印页创建 image_watermark 模板。'}
        {query.error && <span className="ml-2 text-[var(--color-danger)]">模板读取失败，请稍后重试。</span>}
      </div>
    </section>
  )
}

function isWatermarkTemplate(template: ListingTemplate) {
  return template.template_data?.template_type === 'image_watermark'
}

function isTemplateAvailableForPlatform(template: ListingTemplate, platform?: string) {
  if (!platform || template.platform === 'all') return true
  return template.platform.toLowerCase() === platform.toLowerCase()
}
