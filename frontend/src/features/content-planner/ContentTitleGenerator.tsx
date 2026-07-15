import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, FileCheck2, Sparkles } from 'lucide-react'
import {
  confirmContentTaskVersion,
  generateTitle,
  generateTitlesFiveStep,
  saveContentTaskVersion,
  type ContentWorkbenchItem,
} from '../../api/content'
import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import type { ToastContextType } from '../../components/ui/Toast'
import { useConfig } from '../../hooks/useConfig'
import { logger } from '../../utils/logger'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'

export function ContentTitleGenerator({
  toast,
  product,
  onGenerated,
}: {
  toast: ToastContextType
  product?: ContentWorkbenchItem | null
  onGenerated?: () => void
}) {
  const { platforms, markets, categories } = useConfig()
  const [form, setForm] = useState({
    product_name: '', features: '', material: '', scenes: '',
    target_audience: '', platform: '', market: '', category: '',
  })
  const [titles, setTitles] = useState<string[]>([])
  const [keywords, setKeywords] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState('')
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState('')
  const [mode, setMode] = useState<'simple' | 'fivestep'>('simple')
  const [selectedTitle, setSelectedTitle] = useState('')
  const [manualBullets, setManualBullets] = useState<string[]>(['', '', '', '', ''])
  const [manualDescription, setManualDescription] = useState('')
  const contentPlatforms = filterPlatformsByCapability(platforms, 'content')

  useEffect(() => {
    if (!product) return
    setForm(current => ({
      ...current,
      product_name: product.product_name,
      category: product.category || current.category,
      platform: product.target_platform || current.platform,
      market: product.target_market || current.market,
    }))
    setSelectedTitle(product.content_brief?.title || '')
    setManualBullets(normalizeBullets(product.content_brief?.bullets || []))
    setManualDescription('')
  }, [product?.id])

  const handleGenerate = async () => {
    if (!form.product_name.trim() || !form.platform || !form.market) return
    setLoading(true)
    setTitles([])
    setKeywords(null)
    setNote('')
    setEvidence('')
    try {
      if (mode === 'fivestep') {
        const res = await generateTitlesFiveStep({
          product_name: form.product_name,
          category: form.category,
          platform: form.platform,
          market: form.market,
          features: form.features,
          material: form.material,
          target_audience: form.target_audience,
          scenes: form.scenes,
          content_item_id: product?.id,
        })
        const data: any = res.data
        if (data?.titles) setTitles(data.titles)
        if (data?.titles?.[0]) setSelectedTitle(data.titles[0])
        if (data?.keywords) setKeywords(data.keywords)
        if (data?.confidence_reason) setEvidence(`${data.evidence_window || '当前输入'}；${data.confidence_reason}`)
        if (data?.task_version) onGenerated?.()
      } else {
        const res = await generateTitle({ ...form, content_item_id: product?.id })
        const data: any = res.data
        if (data?.titles) setTitles(data.titles)
        if (data?.titles?.[0]) setSelectedTitle(data.titles[0])
        if (data?.note) setNote(data.note)
        if (data?.confidence_reason) setEvidence(`${data.evidence_window || '当前输入'}；${data.confidence_reason}`)
        if (data?.task_version) onGenerated?.()
      }
    } catch (e: any) {
      logger.error('Generate title failed', e)
      toast.addToast('error', e?.response?.data?.detail || '标题生成失败')
    }
    setLoading(false)
  }

  const copyTitle = (title: string) => {
    navigator.clipboard.writeText(title)
    toast.addToast('success', '已复制')
  }

  const updateBullet = (index: number, value: string) => {
    setManualBullets(current => current.map((item, i) => i === index ? value : item))
  }

  const saveAndConfirm = async (taskType: string, content: string) => {
    if (!product?.id || !content.trim()) return
    setSaving(taskType)
    try {
      const saved = await saveContentTaskVersion(product.id, taskType, content.trim(), 'manual')
      const version = saved.data?.version
      if (version) await confirmContentTaskVersion(product.id, taskType, version)
      toast.addToast('success', '已保存并确认到当前商品内容任务')
      onGenerated?.()
    } catch (e: any) {
      logger.error('Save listing copy task failed', e)
      toast.addToast('error', e?.response?.data?.detail || '文案保存失败')
    } finally {
      setSaving('')
    }
  }

  const bulletText = manualBullets.map((item, index) => `${index + 1}. ${item.trim() || '待补卖点'}`).join('\n')
  const titleLength = selectedTitle.trim().length
  const filledBullets = manualBullets.filter(item => item.trim()).length
  const keywordTerms = extractKeywordTerms(keywords, form)
  const keywordHitCount = keywordTerms.filter(term => selectedTitle.toLowerCase().includes(term.toLowerCase())).length
  const titleReady = titleLength >= 35 && titleLength <= 120
  const bulletReady = filledBullets >= 5
  const descriptionReady = manualDescription.trim().length >= 80

  return (
    <section aria-label="Listing 文案编辑工作台" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">Listing 文案</p>
            <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">标题、五点卖点与长描述编辑台</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-muted)]">围绕当前商品处理买家可见文案和平台检索信息；生成只是候选，必须人工确认后才进入内容任务矩阵。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={titleReady ? 'success' : 'warning'}>标题 {titleLength} 字</Badge>
            <Badge variant={bulletReady ? 'success' : 'warning'}>卖点 {filledBullets}/5</Badge>
            <Badge variant={descriptionReady ? 'success' : 'default'}>描述 {manualDescription.trim().length} 字</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
        <Card className="rounded-none border-0 border-b border-[var(--color-border)] shadow-none xl:border-b-0 xl:border-r">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="font-semibold text-[var(--color-fg)]">生成输入</h3>
              </div>
              <div className="flex items-center gap-1 bg-[var(--color-bg)] rounded-lg p-0.5">
                <button onClick={() => setMode('simple')} className={`text-[11px] px-2 py-1 rounded ${mode === 'simple' ? 'bg-[var(--color-surface)] shadow text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>快速</button>
                <button onClick={() => setMode('fivestep')} className={`text-[11px] px-2 py-1 rounded ${mode === 'fivestep' ? 'bg-[var(--color-surface)] shadow text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>五步法</button>
              </div>
            </div>
            <FormField label="* 产品名称"><input className={inputClass} placeholder="硅胶宠物慢食碗" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></FormField>
            <FormField label="核心功能"><input className={inputClass} placeholder="防噎、慢食、易清洗" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} /></FormField>
            <FormField label="材质"><input className={inputClass} placeholder="食品级硅胶" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} /></FormField>
            <FormField label="平台">
              <select className={inputClass} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                <option value="">请选择平台</option>
                {contentPlatforms.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
              </select>
            </FormField>
            <FormField label="市场">
              <select className={inputClass} value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>
                <option value="">请选择市场</option>
                {markets.map(market => <option key={market.id} value={market.id}>{market.flag ? `${market.flag} ` : ''}{market.label}</option>)}
              </select>
            </FormField>
            {mode === 'fivestep' && (
              <FormField label="品类">
                <select className={inputClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">选品类（五步法）</option>
                  {categories.map(category => <option key={category.id} value={category.label}>{category.label}</option>)}
                </select>
              </FormField>
            )}
            <Button className="w-full" onClick={handleGenerate} disabled={loading || !form.product_name.trim() || !form.platform || !form.market}>
              <Sparkles className="w-3.5 h-3.5 mr-1" />{loading ? '生成中...' : mode === 'fivestep' ? '五步法生成候选' : 'AI生成标题候选'}
            </Button>
            {mode === 'fivestep' && <p className="text-[11px] text-[var(--color-muted)]">五步法融合趋势热词、竞品高频词与平台标题规则。</p>}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4 p-4">
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--color-fg)]">标题候选与人工定稿</h3>
                <Button size="sm" onClick={() => saveAndConfirm('listing_copy', selectedTitle)} disabled={saving === 'listing_copy' || !selectedTitle.trim()}>
                  <FileCheck2 className="mr-1 h-3.5 w-3.5" />确认标题
                </Button>
              </div>
              <textarea className="min-h-[84px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm leading-6 text-[var(--color-fg)] outline-none" value={selectedTitle} onChange={event => setSelectedTitle(event.target.value)} placeholder="选择或编辑最终标题" />
              {titles.length > 0 && (
                <div className="grid gap-2">
                  {titles.map((title, index) => (
                    <button key={index} type="button" onClick={() => setSelectedTitle(title)} className={`rounded-xl border p-3 text-left text-sm transition ${selectedTitle === title ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'}`}>
                      <span className="block text-[var(--color-fg)]">{title}</span>
                      <span className="mt-1 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                        <span>标题 {title.length} 字</span>
                        <Copy className="h-3.5 w-3.5" onClick={(event) => { event.stopPropagation(); copyTitle(title) }} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--color-fg)]">五点卖点</h3>
                <Button size="sm" variant="outline" onClick={() => saveAndConfirm('selling_points', bulletText)} disabled={saving === 'selling_points' || filledBullets === 0}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />确认卖点
                </Button>
              </div>
              <div className="grid gap-2">
                {manualBullets.map((bullet, index) => (
                  <label key={index} className="grid gap-1 text-xs text-[var(--color-muted)]">
                    卖点 {index + 1}
                    <input className={inputClass} value={bullet} onChange={event => updateBullet(index, event.target.value)} placeholder={['核心功能/痛点', '材质/安全', '规格/适配', '场景/人群', '信任/售后'][index]} />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[var(--color-fg)]">长描述 / 商品详情</h3>
                <Button size="sm" variant="outline" onClick={() => saveAndConfirm('description', manualDescription)} disabled={saving === 'description' || !manualDescription.trim()}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />确认描述
                </Button>
              </div>
              <textarea className="min-h-[160px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm leading-6 text-[var(--color-fg)] outline-none" value={manualDescription} onChange={event => setManualDescription(event.target.value)} placeholder="补充材质、尺寸、使用方式、适用场景、包装配件、售后说明。" />
            </CardContent>
          </Card>
        </div>

        <aside aria-label="Listing 文案校验面板" className="border-t border-[var(--color-border)] bg-[var(--color-bg)] p-4 xl:border-l xl:border-t-0">
          <p className="text-xs font-semibold text-[var(--color-fg)]">文案校验</p>
          <div className="mt-3 grid gap-2">
            <CopyCheck label="标题长度" value={`${titleLength} 字`} ok={titleReady} detail="建议 35-120 字，发布前再按平台精确规则校验。" />
            <CopyCheck label="关键词覆盖" value={`${keywordHitCount}/${keywordTerms.length}`} ok={keywordTerms.length === 0 || keywordHitCount > 0} detail={keywordTerms.slice(0, 6).join('、') || '等待生成关键词或补充核心功能。'} />
            <CopyCheck label="五点卖点" value={`${filledBullets}/5`} ok={bulletReady} detail="跨境 Listing 需要快速说明功能、材质、规格、场景和信任点。" />
            <CopyCheck label="长描述" value={`${manualDescription.trim().length} 字`} ok={descriptionReady} detail="详情描述应覆盖材质、尺寸、使用方式、包装和售后。" />
            <CopyCheck label="人工确认" value={product ? '写入内容任务' : '未选择商品'} ok={Boolean(product)} detail="确认后进入内容任务矩阵，供定价校验和刊登使用。" />
          </div>
        </aside>
      </div>

      {note && <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning)] rounded-lg p-3 text-xs text-[var(--color-warning)]">{note}</div>}
      {evidence && <div className="border border-[var(--color-border)] rounded-lg p-3 text-xs text-[var(--color-muted)]">依据：{evidence}</div>}
      {keywords && (
        <Card className="m-4">
          <CardContent className="pt-3 text-xs">
            <p className="font-medium text-[var(--color-fg)] mb-1">关键词构成</p>
            <div className="flex flex-wrap gap-1">
              {keywords.attribute_words?.slice(0, 10).map((word: string, index: number) => (
                <span key={index} className="px-1.5 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded text-[11px] border border-[var(--color-primary)]">{word}</span>
              ))}
              {keywords.trend_words?.slice(0, 5).map((word: string, index: number) => (
                <span key={index} className="px-1.5 py-0.5 bg-[var(--color-success-light)] text-[var(--color-success)] rounded text-[11px] border border-[var(--color-success)]">{word}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]'

function normalizeBullets(bullets: string[]) {
  const next = bullets.slice(0, 5)
  while (next.length < 5) next.push('')
  return next
}

function extractKeywordTerms(keywords: any, form: { features: string; material: string; category: string }) {
  const fromAi = [
    ...(keywords?.attribute_words || []),
    ...(keywords?.trend_words || []),
  ].filter(Boolean)
  const fromInput = [form.features, form.material, form.category]
    .flatMap(item => String(item || '').split(/[,\s，、]+/))
    .filter(Boolean)
  return Array.from(new Set([...fromAi, ...fromInput])).slice(0, 12)
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-[11px] text-[var(--color-muted)]">{label}{children}</label>
}

function CopyCheck({ label, value, ok, detail }: { label: string; value: string; ok: boolean; detail: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">{label}</p>
        <span className={ok ? 'text-xs font-semibold text-[var(--color-success)]' : 'text-xs font-semibold text-[var(--color-warning)]'}>{value}</span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}
