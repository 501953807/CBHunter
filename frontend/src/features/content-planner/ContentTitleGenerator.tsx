import { useEffect, useState } from 'react'
import { Copy, Sparkles } from 'lucide-react'
import { generateTitle, generateTitlesFiveStep, type ContentWorkbenchItem } from '../../api/content'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
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
  const [note, setNote] = useState('')
  const [evidence, setEvidence] = useState('')
  const [mode, setMode] = useState<'simple' | 'fivestep'>('simple')
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
        if (data?.keywords) setKeywords(data.keywords)
        if (data?.confidence_reason) setEvidence(`${data.evidence_window || '当前输入'}；${data.confidence_reason}`)
        if (data?.task_version) onGenerated?.()
      } else {
        const res = await generateTitle({ ...form, content_item_id: product?.id })
        const data: any = res.data
        if (data?.titles) setTitles(data.titles)
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <h3 className="font-semibold text-[var(--color-fg)]">产品信息</h3>
            </div>
            <div className="flex items-center gap-1 bg-[var(--color-bg)] rounded-lg p-0.5">
              <button onClick={() => setMode('simple')} className={`text-[11px] px-2 py-1 rounded ${mode === 'simple' ? 'bg-[var(--color-surface)] shadow text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>快速</button>
              <button onClick={() => setMode('fivestep')} className={`text-[11px] px-2 py-1 rounded ${mode === 'fivestep' ? 'bg-[var(--color-surface)] shadow text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}>五步法</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-[11px] text-[var(--color-muted)] mb-0.5">* 产品名称</p>
              <input className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-accent)]" placeholder="硅胶宠物慢食碗" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} />
            </div>
            <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-accent)]" placeholder="核心功能" value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} />
            <input className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-accent)]" placeholder="材质" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} />
            <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
              <option value="">请选择平台</option>
              {contentPlatforms.map(platform => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
            </select>
            <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}>
              <option value="">请选择市场</option>
              {markets.map(market => <option key={market.id} value={market.id}>{market.flag ? `${market.flag} ` : ''}{market.label}</option>)}
            </select>
            {mode === 'fivestep' && (
              <select className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none bg-[var(--color-surface)]" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">选品类（五步法）</option>
                {categories.map(category => <option key={category.id} value={category.label}>{category.label}</option>)}
              </select>
            )}
          </div>
          <Button onClick={handleGenerate} disabled={loading || !form.product_name.trim() || !form.platform || !form.market}>
            <Sparkles className="w-3.5 h-3.5 mr-1" />{loading ? '生成中...' : mode === 'fivestep' ? '五步法生成' : 'AI生成标题'}
          </Button>
          {mode === 'fivestep' && <p className="text-[11px] text-[var(--color-muted)]">五步法融合趋势热词、竞品高频词与平台标题规则</p>}
        </CardContent>
      </Card>
      {note && <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning)] rounded-lg p-3 text-xs text-[var(--color-warning)]">{note}</div>}
      {evidence && <div className="border border-[var(--color-border)] rounded-lg p-3 text-xs text-[var(--color-muted)]">依据：{evidence}</div>}
      {keywords && (
        <Card>
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
      {titles.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-[var(--color-fg)]">生成标题（{titles.length}个）</h3></CardHeader>
          <CardContent className="space-y-2">
            {titles.map((title, index) => (
              <div key={index} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${index === 0 ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]' : 'border-[var(--color-border)]'}`}>
                <span className="text-[var(--color-fg)]">{title}</span>
                <button onClick={() => copyTitle(title)} className="text-[var(--color-primary)] shrink-0 ml-2" title="复制标题"><Copy className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
