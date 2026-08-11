import { useEffect, useState } from 'react'
import { Copy, Image, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { useConfig } from '../../hooks/useConfig'
import { createListingTemplate, deleteListingTemplate, listListingTemplates, updateListingTemplate, type ListingTemplate, type ListingTemplateInput } from '../../api/templates'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'

type WatermarkDraft = {
  name: string
  description: string
  platform: string
  scope: string
  position: string
  opacity: string
  text: string
  color: string
  scheduleMode: string
  productFilter: string
  isDefault: boolean
}

type WatermarkGovernanceSummary = {
  templateCount: number
  defaultTemplateCount: number
  platformCount: number
  scheduledCount: number
  contentFactoryReadyCount: number
  scopedProductCount: number
  platformLabels: string
  runtimeBoundary: string
}

const EMPTY_DRAFT: WatermarkDraft = {
  name: '',
  description: '',
  platform: '',
  scope: 'first_main_image',
  position: 'top_left',
  opacity: '80',
  text: '',
  color: '#ffffff',
  scheduleMode: 'manual',
  productFilter: '',
  isDefault: false,
}

const WATERMARK_SCOPES = [
  { value: 'first_main_image', label: '第一张主图' },
  { value: 'all_main_images', label: '全部主图' },
  { value: 'selected_products', label: '指定商品' },
]

const WATERMARK_POSITIONS = [
  { value: 'top_left', label: '左上角' },
  { value: 'top_right', label: '右上角' },
  { value: 'bottom_left', label: '左下角' },
  { value: 'bottom_right', label: '右下角' },
  { value: 'center', label: '居中' },
]

export default function ListingTemplatesWorkspace() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const { platforms } = useConfig()
  const listingPlatforms = filterPlatformsByCapability(platforms, 'listing')
  const [templates, setTemplates] = useState<ListingTemplate[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<ListingTemplate[]> | null>(null)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [draft, setDraft] = useState<WatermarkDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listListingTemplates()
      const watermarkTemplates = (res.data || []).filter(isWatermarkTemplate)
      setTemplates(watermarkTemplates)
      setEvidence({
        ...res,
        source_refs: watermarkTemplates.map(template => ({ type: 'image_watermark_template', id: template.id, label: template.name })),
        evidence_window: '当前用户图片/水印模板配置',
        confidence_reason: '图片/水印模板列表仅展示 template_type=image_watermark 的配置；旧 Listing 文案模板不再作为本页面数据来源。',
        data_gaps: watermarkTemplates.length ? [] : ['暂无图片/水印模板'],
      })
    } catch (e: any) {
      logger.error('Load image watermark templates failed', e)
      toast.addToast('error', '图片/水印模板加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filteredTemplates = templates.filter(template => {
    const wm = toWatermarkDraft(template)
    const text = `${template.name} ${template.description || ''} ${wm.productFilter}`.toLowerCase()
    const matchedQuery = !query.trim() || text.includes(query.trim().toLowerCase())
    const matchedScope = scopeFilter === 'all' || wm.scope === scopeFilter
    return matchedQuery && matchedScope
  })
  const governanceSummary = buildWatermarkGovernanceSummary(templates)

  const startCreate = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setOpen(true)
  }

  const startEdit = (template: ListingTemplate) => {
    setEditingId(template.id)
    setDraft(toWatermarkDraft(template))
    setOpen(true)
  }

  const save = async () => {
    if (!draft.name.trim() || !draft.platform) {
      toast.addToast('error', '请填写水印名称和适用平台')
      return
    }
    setSaving(true)
    const payload: ListingTemplateInput = {
      name: draft.name,
      description: draft.description,
      platform: draft.platform,
      category_id: null,
      is_default: draft.isDefault,
      template_data: {
        template_type: 'image_watermark',
        watermark_scope: draft.scope,
        watermark_position: draft.position,
        watermark_opacity: draft.opacity,
        watermark_text: draft.text,
        watermark_color: draft.color,
        schedule_mode: draft.scheduleMode,
        product_filter: draft.productFilter,
        title_template: '',
        description_template: '',
      },
    }
    try {
      if (editingId) await updateListingTemplate(editingId, payload)
      else await createListingTemplate(payload)
      toast.addToast('success', editingId ? '水印模板已更新' : '水印模板已创建')
      setOpen(false)
      await load()
    } catch (e: any) {
      logger.error('Save image watermark template failed', e)
      toast.addToast('error', e?.response?.data?.detail || '水印模板保存失败')
    }
    setSaving(false)
  }

  const remove = async (template: ListingTemplate) => {
    const ok = await confirmAction({
      title: '删除图片/水印模板',
      message: `确认删除模板「${template.name}」？已处理的商品图片不会被删除，但后续不能再追加投放该模板。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteListingTemplate(template.id)
      toast.addToast('success', '水印模板已删除')
      await load()
    } catch (e: any) {
      logger.error('Delete image watermark template failed', e)
      toast.addToast('error', '水印模板删除失败')
    }
  }

  return (
    <div className="listing-templates-shell page-enter" data-ui="image-watermark-template-workspace">
      <section className="listing-templates-hero p-5" aria-label="图片水印模板工作台标题区">
        <div className="listing-templates-hero-content">
          <div>
            <p className="listing-templates-eyebrow">Image Watermark Studio</p>
            <h1 className="listing-templates-title">图片/水印模板</h1>
            <p className="listing-templates-subtitle">
              参考妙手 ERP 营销水印：管理主图水印、系统模板、投放范围和追加投放，不再作为 Listing 文案模板入口。
            </p>
          </div>
          <Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" />创建水印</Button>
        </div>
      </section>
      <EvidenceBanner evidence={evidence} />
      <WatermarkGovernancePanel summary={governanceSummary} />

      <Card className="listing-templates-workbench-card">
        <CardContent className="space-y-4 pt-4">
          <div className="listing-templates-filter-toolbar" aria-label="水印模板筛选工具条" data-ui="watermark-template-filter-toolbar">
            <div className="listing-templates-segment-row">
              {['我的主图水印', '系统水印模板'].map(label => (
                <button
                  key={label}
                  type="button"
                  className="listing-templates-segment"
                  data-active={label === '我的主图水印' ? 'true' : 'false'}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="listing-templates-scope-row">
            <div className="listing-templates-search">
              <Search className="h-4 w-4 text-[var(--color-muted)]" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜水印 / 搜产品" />
            </div>
            {[{ value: 'all', label: '全部水印' }, ...WATERMARK_SCOPES].map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => setScopeFilter(item.value)}
                className="listing-templates-scope-chip"
                data-active={scopeFilter === item.value ? 'true' : 'false'}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>

          {loading ? (
            <div className="skeleton-shimmer h-48 rounded-xl" />
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={<Image className="h-10 w-10" />}
              title="暂无图片/水印模板"
              description="创建模板后，可用于内容工厂图片处理和批量刊登前的主图营销水印。"
              action={<Button onClick={startCreate}><Plus className="mr-1 h-4 w-4" />创建水印</Button>}
            />
          ) : (
            <div className="listing-templates-table-shell" data-ui="watermark-template-console-table">
              <table className="listing-templates-table">
                <thead>
                  <tr>
                    {['水印信息', '使用范围', '水印状态', '定时添加', '适用平台', '操作'].map(header => <th key={header}>{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map(template => {
                    const wm = toWatermarkDraft(template)
                    return (
                      <tr key={template.id}>
                        <td>
                          <p className="font-semibold text-[var(--color-fg)]">{template.name}</p>
                          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{template.description || '无备注'}</p>
                          <p className="mt-1 text-[11px] text-[var(--color-muted)]">文字：{wm.text || '图片/品牌图层待配置'}</p>
                        </td>
                        <td className="text-[var(--color-muted)]">{labelOf(WATERMARK_SCOPES, wm.scope)}</td>
                        <td>
                          <div className="listing-templates-status-stack">
                            <span className="text-[var(--color-success)]">成功：0 个</span>
                            <span className="text-[var(--color-danger)]">失败：0 个</span>
                            <span className="text-[var(--color-warning)]">处理中：0 个</span>
                          </div>
                        </td>
                        <td className="text-[var(--color-muted)]">{wm.scheduleMode === 'scheduled' ? '已配置' : '0 个'}</td>
                        <td className="text-[var(--color-muted)]">{template.platform}</td>
                        <td>
                          <div className="listing-templates-row-actions">
                            <button type="button" onClick={() => startEdit(template)} className="listing-templates-row-action" data-tone="primary"><Pencil className="mr-1 inline h-3.5 w-3.5" />编辑水印</button>
                            <button type="button" className="listing-templates-row-action"><Copy className="mr-1 inline h-3.5 w-3.5" />复制水印</button>
                            <button type="button" className="listing-templates-row-action">投放详情</button>
                            <button type="button" className="listing-templates-row-action">追加投放</button>
                            <button type="button" onClick={() => remove(template)} className="listing-templates-row-action" data-tone="danger"><Trash2 className="mr-1 inline h-3.5 w-3.5" />删除水印</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? '编辑图片/水印模板' : '创建图片/水印模板'} size="lg"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存水印模板'}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="水印名称" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
            <Select label="适用平台" value={draft.platform} onChange={platform => setDraft({ ...draft, platform })}
              options={listingPlatforms.map(p => ({ value: p.id, label: p.label }))} placeholder="选择平台" />
            <Select label="水印使用范围" value={draft.scope} onChange={scope => setDraft({ ...draft, scope })} options={WATERMARK_SCOPES} />
            <Select label="水印位置" value={draft.position} onChange={position => setDraft({ ...draft, position })} options={WATERMARK_POSITIONS} />
            <Input label="透明度(%)" value={draft.opacity} onChange={event => setDraft({ ...draft, opacity: event.target.value })} />
            <Input label="水印颜色" value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} />
          </div>
          <Input label="水印文字/品牌图层说明" value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} />
          <Input label="搜产品条件/投放商品范围" value={draft.productFilter} onChange={event => setDraft({ ...draft, productFilter: event.target.value })} />
          <Input label="备注" value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} />
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
            <input type="checkbox" checked={draft.isDefault} onChange={event => setDraft({ ...draft, isDefault: event.target.checked })} />
            设为该平台默认水印模板
          </label>
          <section aria-label="营销水印预览占位" className="listing-templates-preview-panel">
            <p className="text-sm font-semibold text-[var(--color-fg)]">主图水印预览</p>
            <div className="listing-templates-preview-canvas mt-3">
              后续接入 fabric.js / cropperjs 后在此预览真实主图、水印位置、透明度和导出效果。
            </div>
          </section>
        </div>
      </Modal>
    </div>
  )
}

function WatermarkGovernancePanel({ summary }: { summary: WatermarkGovernanceSummary }) {
  return (
    <section data-ui="watermark-template-governance-summary" className="listing-templates-governance-grid">
      <WatermarkMetric label="水印模板" value={summary.templateCount} note={`默认模板 ${summary.defaultTemplateCount} 个`} />
      <WatermarkMetric label="平台覆盖" value={summary.platformCount} note={summary.platformLabels} />
      <WatermarkMetric label="投放规则" value={summary.scheduledCount} note={`定时投放 ${summary.scheduledCount} · 指定商品 ${summary.scopedProductCount}`} />
      <WatermarkMetric label="内容工厂可用" value={summary.contentFactoryReadyCount} note="有文字或品牌图层说明的模板可被图片工作台应用" />
      <div className="listing-templates-boundary-panel md:col-span-4">
        <p className="text-xs font-semibold text-[var(--color-fg)]">水印运行边界</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{summary.runtimeBoundary}</p>
      </div>
    </section>
  )
}

function WatermarkMetric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="listing-templates-metric-card">
      <p className="listing-templates-metric-label">{label}</p>
      <p className="listing-templates-metric-value">{value}</p>
      <p className="listing-templates-metric-note line-clamp-2">{note || '待配置'}</p>
    </div>
  )
}

function isWatermarkTemplate(template: ListingTemplate) {
  return template.template_data?.template_type === 'image_watermark'
}

function buildWatermarkGovernanceSummary(templates: ListingTemplate[]): WatermarkGovernanceSummary {
  const platformSet = new Set<string>()
  let defaultTemplateCount = 0
  let scheduledCount = 0
  let contentFactoryReadyCount = 0
  let scopedProductCount = 0
  templates.forEach(template => {
    const wm = toWatermarkDraft(template)
    platformSet.add(template.platform)
    if (template.is_default) defaultTemplateCount += 1
    if (wm.scheduleMode === 'scheduled') scheduledCount += 1
    if (wm.text || wm.description) contentFactoryReadyCount += 1
    if (wm.scope === 'selected_products' || wm.productFilter) scopedProductCount += 1
  })
  const platformLabels = Array.from(platformSet).map(item => item.toUpperCase()).join(' / ')
  return {
    templateCount: templates.length,
    defaultTemplateCount,
    platformCount: platformSet.size,
    scheduledCount,
    contentFactoryReadyCount,
    scopedProductCount,
    platformLabels,
    runtimeBoundary: '营销水印是图片处理模板，只有在内容工厂图片槽位应用并导出后才进入发布图；模板本身不修改商品基础图片或平台 Listing。',
  }
}

function toWatermarkDraft(template: ListingTemplate): WatermarkDraft {
  return {
    name: template.name,
    description: template.description || '',
    platform: template.platform,
    scope: String(template.template_data?.watermark_scope || 'first_main_image'),
    position: String(template.template_data?.watermark_position || 'top_left'),
    opacity: String(template.template_data?.watermark_opacity || '80'),
    text: String(template.template_data?.watermark_text || ''),
    color: String(template.template_data?.watermark_color || '#ffffff'),
    scheduleMode: String(template.template_data?.schedule_mode || 'manual'),
    productFilter: String(template.template_data?.product_filter || ''),
    isDefault: template.is_default,
  }
}

function labelOf(options: Array<{ value: string; label: string }>, value: string) {
  return options.find(item => item.value === value)?.label || value
}
