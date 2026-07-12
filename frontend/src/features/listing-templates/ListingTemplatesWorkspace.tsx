import { useEffect, useState } from 'react'
import { Braces, FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/shared/PageHeader'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { useConfig } from '../../hooks/useConfig'
import {
  createListingTemplate,
  deleteListingTemplate,
  listListingTemplates,
  previewListingTemplate,
  updateListingTemplate,
  type ListingTemplate,
  type ListingTemplateInput,
} from '../../api/templates'
import { getProducts } from '../../api/products'
import type { ProductListRow } from '../../types/product'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { logger } from '../../utils/logger'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import type { ListingTemplatePreview } from '../../api/templates'

const EMPTY_FORM: ListingTemplateInput = {
  name: '',
  description: '',
  platform: '',
  category_id: null,
  template_data: { title_template: '', description_template: '' },
  is_default: false,
}

const VARIABLES = ['product_name', 'brand', 'sku', 'description', 'category']

export default function ListingTemplatesWorkspace() {
  const toast = useToast()
  const confirmAction = useConfirm()
  const { platforms } = useConfig()
  const listingPlatforms = filterPlatformsByCapability(platforms, 'listing')
  const [templates, setTemplates] = useState<ListingTemplate[]>([])
  const [products, setProducts] = useState<ProductListRow[]>([])
  const [evidence, setEvidence] = useState<ApiResponse<ListingTemplate[]> | null>(null)
  const [previewEvidence, setPreviewEvidence] = useState<ApiResponse<ListingTemplatePreview> | null>(null)
  const [previewProductId, setPreviewProductId] = useState('')
  const [form, setForm] = useState<ListingTemplateInput>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [res, productRes] = await Promise.all([listListingTemplates(), getProducts({ page_size: 100 })])
      setTemplates(res.data || [])
      setProducts(productRes.data || [])
      setEvidence(res)
    } catch (e: any) {
      logger.error('Load listing templates failed', e)
      toast.addToast('error', '模板加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const startCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setPreviewProductId('')
    setPreviewEvidence(null)
    setOpen(true)
  }

  const startEdit = (template: ListingTemplate) => {
    setEditingId(template.id)
    setPreviewProductId('')
    setPreviewEvidence(null)
    setForm({
      name: template.name,
      description: template.description || '',
      platform: template.platform,
      category_id: template.category_id || null,
      template_data: {
        ...template.template_data,
        title_template: template.template_data.title_template || '',
        description_template: template.template_data.description_template || '',
      },
      is_default: template.is_default,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.platform || !form.template_data.title_template?.trim()) {
      toast.addToast('error', '请填写模板名称、平台和标题模板')
      return
    }
    setSaving(true)
    try {
      if (editingId) await updateListingTemplate(editingId, form)
      else await createListingTemplate(form)
      toast.addToast('success', editingId ? '模板已更新' : '模板已创建')
      setOpen(false)
      await load()
    } catch (e: any) {
      logger.error('Save listing template failed', e)
      toast.addToast('error', e?.response?.data?.detail || '模板保存失败')
    }
    setSaving(false)
  }

  const remove = async (template: ListingTemplate) => {
    const ok = await confirmAction({
      title: '删除 Listing 模板',
      message: `确认删除模板「${template.name}」？已生成的 Listing 草稿不会被删除，但后续不能再使用该模板生成内容。`,
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteListingTemplate(template.id)
      toast.addToast('success', '模板已删除')
      await load()
    } catch (e: any) {
      logger.error('Delete listing template failed', e)
      toast.addToast('error', '模板删除失败')
    }
  }

  const runPreview = async () => {
    if (!editingId || !previewProductId) return
    try {
      setPreviewEvidence(await previewListingTemplate(editingId, previewProductId))
    } catch (e: any) {
      logger.error('Preview listing template failed', e)
      toast.addToast('error', '真实商品预览失败')
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        title="Listing 模板"
        description="维护批量刊登使用的标题与描述模板"
        actions={<Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />新建模板</Button>}
      />
      <EvidenceBanner evidence={evidence} />

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="skeleton-shimmer h-48 rounded-xl" />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10" />}
              title="暂无 Listing 模板"
              description="创建模板后，批量刊登才能生成可确认的本地 Listing 草稿"
              action={<Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" />新建模板</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {templates.map(template => (
                <div key={template.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate text-[var(--color-fg)]">{template.name}</p>
                        {template.is_default && <Star className="w-3.5 h-3.5 text-[var(--color-warning)] fill-current" />}
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{template.platform}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button title="编辑" onClick={() => startEdit(template)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-primary)]"><Pencil className="w-3.5 h-3.5" /></button>
                      <button title="删除" onClick={() => remove(template)} className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-danger)]"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-2 line-clamp-2">{template.template_data.title_template || '未填写标题模板'}</p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-2 line-clamp-2">{template.description || '无备注'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? '编辑 Listing 模板' : '新建 Listing 模板'} size="lg"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存模板'}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="模板名称" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Select label="适用平台" value={form.platform} onChange={platform => setForm({ ...form, platform })}
              options={listingPlatforms.map(p => ({ value: p.id, label: p.label }))} placeholder="选择平台" />
          </div>
          <Input label="模板备注" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
            设为该平台默认模板
          </label>
          <TemplateTextarea label="标题模板" value={form.template_data.title_template || ''}
            onChange={value => setForm({ ...form, template_data: { ...form.template_data, title_template: value } })} />
          <TemplateTextarea label="描述模板" value={form.template_data.description_template || ''}
            onChange={value => setForm({ ...form, template_data: { ...form.template_data, description_template: value } })} rows={6} />
          {editingId ? (
            <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
              <p className="text-xs font-semibold text-[var(--color-fg)]">已保存模板的真实商品预览</p>
              <p className="text-[11px] text-[var(--color-muted)]">当前编辑内容需先保存，预览才会使用最新模板。</p>
              <div className="flex gap-2">
                <Select value={previewProductId} onChange={setPreviewProductId} placeholder="选择商品主数据"
                  options={products.map(item => ({ value: item.id, label: `${item.name} · ${item.sku}` }))} />
                <Button size="sm" variant="outline" onClick={runPreview} disabled={!previewProductId}>生成预览</Button>
              </div>
              <EvidenceBanner evidence={previewEvidence} compact />
              {previewEvidence?.data && <pre className="text-xs whitespace-pre-wrap text-[var(--color-muted)]">{JSON.stringify(previewEvidence.data.resolved_data, null, 2)}</pre>}
            </div>
          ) : <p className="text-xs text-[var(--color-muted)]">保存模板后可选择真实商品生成预览；未保存前不填充示例数据。</p>}
        </div>
      </Modal>
    </div>
  )
}

function TemplateTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-[var(--color-fg)]">{label}</label>
        <div className="flex items-center gap-1">
          {VARIABLES.map(variable => <button key={variable} type="button" onClick={() => onChange(`${value}{{${variable}}}`)}
            className="text-[11px] px-1.5 py-0.5 rounded border text-[var(--color-primary)]" style={{ borderColor: 'var(--color-border)' }}>
            <Braces className="w-2.5 h-2.5 inline mr-0.5" />{variable}
          </button>)}
        </div>
      </div>
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-fg)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]" />
    </div>
  )
}
