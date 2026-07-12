import { useState, useEffect, useRef } from 'react'
import { Plus, Check, RefreshCw, Globe } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { useConfirm } from '../../components/ui/ConfirmDialog'
import { listSeeds, createSeed, deleteSeed, resetSeeds, discoverSeeds, type TrendSeed } from '../../api/seeds'
import { getDictionary } from '../../api/config'
import { logger } from '../../utils/logger'
import { DiscoveryProgressPanel, LANGUAGE_LABELS, SeedStatsGrid, SeedTable } from './SeedManagerParts'

export default function SeedManagerTab({ toast }: { toast: any }) {
  const confirmAction = useConfirm()
  const [seeds, setSeeds] = useState<TrendSeed[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<Partial<TrendSeed>>({
    category_id: '', keyword: '', market: null, language: 'auto', is_active: true,
  })
  // Filter state
  const [filterCat, setFilterCat] = useState('')
  const [filterMarket, setFilterMarket] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  // Dictionary data for dropdowns
  const [categories, setCategories] = useState<any[]>([])
  const [markets, setMarkets] = useState<any[]>([])
  const [resetting, setResetting] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryMarkets, setDiscoveryMarkets] = useState<{ id: string; label: string; flag: string; status: 'idle' | 'running' | 'done' | 'error'; count: number; error?: string }[]>([])
  const [discoveryTotal, setDiscoveryTotal] = useState(0)
  const abortRef = useRef(false)

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [globalStats, setGlobalStats] = useState({ active: 0, default: 0, markets: 0, categories: 0 })
  const PAGE_SIZE = 30

  const loadGlobalStats = async () => {
    try {
      const res = await listSeeds({ active_only: false, page_size: 200 })
      const data = (res && res.data) ? res.data : ({ seeds: [] } as any)
      const allSeeds: any[] = data.seeds || []
      const activeSeeds = allSeeds.filter((s: any) => s.is_active)
      // market coverage: null=global → count all dict markets, otherwise count distinct
      const explicitMarkets = new Set(allSeeds.map((s: any) => s.market).filter((m: any) => m != null))
      const hasGlobal = allSeeds.some((s: any) => s.market == null)
      const marketsCovered = hasGlobal ? markets.length : explicitMarkets.size
      setGlobalStats({
        active: activeSeeds.length,
        default: allSeeds.filter((s: any) => s.is_default).length,
        markets: marketsCovered,
        categories: new Set(allSeeds.map((s: any) => s.category_id)).size,
      })
    } catch (e: any) {
      logger.error('Load seed global stats failed', e)
    }
  }

  const loadSeeds = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: PAGE_SIZE }
      if (filterCat) params.category_id = filterCat
      if (filterMarket) params.market = filterMarket
      if (!showInactive) params.active_only = true
      const r = await listSeeds(params)
      setSeeds(r.data?.seeds || [])
      setTotal(r.meta?.total || r.data?.total || 0)
    } catch (e: any) {
      logger.error('Load trend seeds failed', e)
      setSeeds([])
    }
    setLoading(false)
  }

  useEffect(() => { loadSeeds() }, [filterCat, filterMarket, showInactive, page])
  useEffect(() => { loadGlobalStats() }, [markets])

  useEffect(() => {
    getDictionary().then(r => {
      if (r && r.data) {
        setCategories(r.data.categories || [])
        setMarkets(r.data.markets || [])
      }
    }).catch((e: any) => logger.error('Load seed manager dictionaries failed', e))
  }, [])

  const handleAdd = async () => {
    if (!addForm.keyword?.trim()) { toast.addToast('error', '种子词不能为空'); return }
    try {
      await createSeed(addForm)
      toast.addToast('success', '已添加')
      setAdding(false)
      setAddForm({ category_id: '', keyword: '', market: null, language: 'auto', is_active: true })
      loadSeeds()
    } catch (e: any) {
      logger.error('Create trend seed failed', e)
      toast.addToast('error', '添加失败')
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: '删除趋势种子词',
      message: '确定删除该种子词？删除后趋势同步不会再使用它扩展关键词。',
      confirmText: '删除',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteSeed(id); toast.addToast('success', '已删除'); loadSeeds(); loadGlobalStats() }
    catch (e: any) {
      logger.error('Delete trend seed failed', e)
      toast.addToast('error', '删除失败')
    }
  }

  const handleReset = async () => {
    const ok = await confirmAction({
      title: '恢复默认种子词',
      message: '确定恢复到默认种子词？用户添加的种子词将被删除。',
      confirmText: '恢复默认',
      tone: 'warning',
    })
    if (!ok) return
    setResetting(true)
    try { await resetSeeds(); toast.addToast('success', '已恢复默认'); loadSeeds(); loadGlobalStats() }
    catch (e: any) {
      logger.error('Reset trend seeds failed', e)
      toast.addToast('error', '恢复失败')
    }
    setResetting(false)
  }

  const handleDiscover = async () => {
    if (markets.length === 0) { toast.addToast('error', '未加载市场列表'); return }
    abortRef.current = false
    setDiscovering(true)
    setDiscoveryTotal(0)
    const init = markets.map((m: any) => ({ id: m.id, label: m.label, flag: (m.extra && m.extra.flag) || (typeof m.flag === 'string' ? m.flag : ''), status: 'idle' as const, count: 0 }))
    setDiscoveryMarkets([...init])

    // Use bulk endpoint: browser opens once, all markets processed
    try {
      const marketIds = init.map((m: any) => m.id)
      const r = await discoverSeeds(marketIds)
      const bulkResult = r.data || {}
      const results: any[] = bulkResult.results || []
      const newTotal = bulkResult.total_new || 0

      for (let i = 0; i < init.length; i++) {
        const mResult = results.find((res: any) => res.market === init[i].id)
        if (mResult) {
          if (mResult.abort) {
            setDiscoveryMarkets(prev => prev.map((d, idx) => idx === i ? { ...d, status: 'error' as const, error: (mResult.errors || ['验证失败']).join('; ') } : d))
          } else {
            setDiscoveryMarkets(prev => prev.map((d, idx) => idx === i ? { ...d, status: 'done' as const, count: mResult.new_seeds || 0 } : d))
          }
        } else {
          setDiscoveryMarkets(prev => prev.map((d, idx) => idx === i ? { ...d, status: 'error' as const, error: '未返回结果' } : d))
        }
      }
      setDiscoveryTotal(newTotal)
    } catch (e: any) {
      logger.error('Discover trend seeds failed', e)
      const errMsg = e?.response?.data?.detail || e.message || '未知错误'
      setDiscoveryMarkets(prev => prev.map(d => ({ ...d, status: 'error' as const, error: errMsg })))
      setDiscoveryTotal(0)
    }
    setDiscovering(false)
    loadSeeds()
    loadGlobalStats()
    if (!abortRef.current) {
      const successCount = discoveryMarkets.filter(d => d.status === 'done').length
      toast.addToast('success', discoveryTotal > 0 ? `发掘完成，新增 ${discoveryTotal} 个种子词` : `发掘完成，${successCount} 个市场已完成`)
    }
  }

  return (<div className="space-y-6">
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>配置每个品类的趋势发现种子词。同步时用种子词在 Google Trends / Pinterest 上发现热门关键词。</p>
      <SeedStatsGrid stats={globalStats} />

      {/* Filters & actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
        >
          <option value="">全部品类</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.icon || ''} {c.label}</option>
          ))}
        </select>
        <select
          value={filterMarket}
          onChange={e => setFilterMarket(e.target.value)}
          className="text-xs border rounded-lg px-2 py-1.5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
        >
          <option value="">全部市场</option>
          {markets.map((m: any) => (
            <option key={m.id} value={m.id}>{m.flag || ''} {m.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--color-muted)' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-3 h-3" />
          显示已禁用
        </label>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5">
          <button onClick={handleDiscover} disabled={discovering}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border font-medium"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
            <Globe className={`w-3 h-3 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? `发掘中 (${discoveryMarkets.filter(d => d.status === 'done' || d.status === 'error').length}/${discoveryMarkets.length})…` : '种子词发掘'}
          </button>
          <span className="relative"
            onMouseEnter={e => {
              const el = (e.currentTarget as HTMLElement).querySelector('.seed-tip') as HTMLElement
              if (el) el.style.display = 'block'
            }}
            onMouseLeave={e => {
              const el = (e.currentTarget as HTMLElement).querySelector('.seed-tip') as HTMLElement
              if (el) el.style.display = 'none'
            }}
          >
            <span className="flex items-center justify-center w-4 h-4 rounded-full text-[11px] leading-none cursor-help border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>?</span>
            <span className="seed-tip absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 z-50" style={{ display: 'none' }}>
              <span className="block text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-lg border"
                style={{ background: 'var(--color-surface)', color: 'var(--color-fg)', borderColor: 'var(--color-border)' }}>
                通过 Google Trends 逐一扫描全部市场的热门话题和上升趋势，自动生成与各品类匹配的种子词。按顺序执行以避免限流，全程约需 1-2 分钟。
              </span>
            </span>
          </span>
        </span>
        <button onClick={handleReset} disabled={resetting}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}>
          <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
          恢复默认
        </button>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-[var(--color-primary-text)]"
          style={{ background: 'var(--gradient-accent)' }}>
          <Plus className="w-3 h-3" /> 新增
        </button>
      </div>

      <DiscoveryProgressPanel discovering={discovering} discoveryMarkets={discoveryMarkets} discoveryTotal={discoveryTotal} />

      {/* Add form */}
      {adding && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
              <div>
                <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>品类</label>
                <select value={addForm.category_id || ''} onChange={e => setAddForm({ ...addForm, category_id: e.target.value })}
                  className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.icon || ''} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>市场</label>
                <select value={addForm.market || ''} onChange={e => setAddForm({ ...addForm, market: e.target.value || null })}
                  className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                  <option value="">全部</option>
                  {markets.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.flag || ''} {m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>种子词</label>
                <input className="w-full text-xs border rounded px-2 py-1.5" placeholder="e.g. wireless earbuds"
                  value={addForm.keyword || ''} onChange={e => setAddForm({ ...addForm, keyword: e.target.value })}
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
              </div>
              <div>
                <label className="text-[11px] block mb-0.5" style={{ color: 'var(--color-muted)' }}>语言</label>
                <select value={addForm.language || 'en'} onChange={e => setAddForm({ ...addForm, language: e.target.value })}
                  className="w-full text-xs border rounded px-2 py-1.5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                  {Object.keys(LANGUAGE_LABELS).map(k => (
                    <option key={k} value={k}>{LANGUAGE_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleAdd} className="text-xs px-3 py-1.5 rounded bg-[var(--color-success)] text-[var(--color-primary-text)]"><Check className="w-3 h-3 inline mr-1" />添加</button>
                <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded border" style={{ borderColor: 'var(--color-border)' }}>取消</button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SeedTable
        categories={categories}
        loading={loading}
        seeds={seeds}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onAdd={() => setAdding(true)}
        onDelete={handleDelete}
        onPageChange={setPage}
      />
    </div>
  )
}
