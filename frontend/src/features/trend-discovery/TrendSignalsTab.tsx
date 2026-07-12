import React, { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Globe, Minus, Plus, Trash2, TrendingUp, TriangleAlert } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { useToast } from "../../components/ui/Toast"
import { EvidenceBanner } from "../../components/shared/EvidenceBanner"
import { deleteCapturedKeyword, listCapturedKeywords } from "../../api/discovery"
import { addToSourcing } from "../../api/sourcing"
import { createScoutSignal } from "../../api/scout"
import type { DictCategory } from "../../api/config"
import { logger } from "../../utils/logger"
import type { DictShape } from "./TrendDiscoveryTypes"
import type { ApiResponse } from "../../types/common"

const DIR_LABEL: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  rising: { icon: <ArrowUp className="w-3 h-3" />, color: 'text-[var(--color-success)]', label: '上升' },
  falling: { icon: <ArrowDown className="w-3 h-3" />, color: 'text-[var(--color-danger)]', label: '下降' },
  stable: { icon: <Minus className="w-3 h-3" />, color: 'text-[var(--color-warning)]', label: '平稳' } }

/* Compact textual sparkline derived only from real saved samples. */
function TrendLine({ values }: { values: number[] }) {
  const blocks = '▁▂▃▄▅▆▇█'
  if (!values || values.length === 0) {
    return <span className="text-[11px] text-[var(--color-muted)]">暂无趋势曲线</span>
  }
  const max = Math.max(...values, 1)
  const chars = values.map(v => blocks[Math.min(Math.floor((v / max) * (blocks.length - 1)), blocks.length - 1)])
  return <span className="text-xs tracking-[0.5px] text-[var(--color-muted)] font-mono">{chars.join('')}</span>
}
export function OldTrendsTab({ dict }: { dict: DictShape }) {
  const [trendData, setTrendData] = useState<any>(null)
  const [trendEvidence, setTrendEvidence] = useState<ApiResponse | null>(null)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string>('')
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  // Per-market add keyword state
  const [addMarket, setAddMarket] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ keyword: '', search_volume: '', growth_pct: '' })
  const toast = useToast()

  const refreshData = async () => {
    setTrendError(null)
    try {
      const params: Record<string, any> = {}
      if (selectedMarket) params.market = selectedMarket
      const res = await listCapturedKeywords(params)
      if (res.data) setTrendData(res.data)
      setTrendEvidence(res)
    } catch (e: any) {
      setTrendError(e?.response?.data?.detail || e?.message || '加载趋势数据失败')
    }
  }

  const handleAddKeyword = async (market: string) => {
    if (!addForm.keyword.trim()) return
    setAdding(true)
    try {
      await createScoutSignal({
        source_id: 'google_trends', keyword: addForm.keyword.trim(), product_idea: addForm.keyword.trim(),
        heat_level: addForm.search_volume ? parseInt(addForm.search_volume) : undefined, market, category: selectedCat,
        search_volume: addForm.search_volume ? parseInt(addForm.search_volume) : undefined,
        growth_pct: addForm.growth_pct ? parseFloat(addForm.growth_pct) / 100 : undefined })
      setAddForm({ keyword: '', search_volume: '', growth_pct: '' })
      setAddMarket(null); refreshData()
    } catch (e: any) { logger.error('Failed to add keyword', e) }
    setAdding(false)
  }

  useEffect(() => {
    (async () => {
      setTrendLoading(true)
      try {
        const params: Record<string, any> = {}
        if (selectedMarket) params.market = selectedMarket
        const res = await listCapturedKeywords(params)
        setTrendEvidence(res)
        if (res.data) {
          const d = res.data as any
          setTrendData(d)
          // Auto-select first category if none selected yet.
          // Fall back to dict categories when captured data has none of its own.
          if (!selectedCat) {
            const cats = d.categories?.length > 0
              ? d.categories
              : (dict?.categories || []).map((c: any) => c.id)
            if (cats.length > 0) setSelectedCat(cats[0])
          }
        }
        setTrendError(null)
      } catch (e: any) {
        setTrendError(e?.response?.data?.detail || e?.message || '加载趋势数据失败')
      }
      setTrendLoading(false)
    })()
  }, [selectedMarket])

  // When dict arrives late, auto-select a category if none picked yet
  useEffect(() => {
    if (!selectedCat && dict?.categories?.length && trendData) {
      const cats = (trendData as any)?.categories?.length > 0
        ? (trendData as any).categories
        : dict.categories.map((c: any) => c.id)
      if (cats.length > 0) setSelectedCat(cats[0])
    }
  }, [dict, selectedCat, trendData])

  const categoryMarkets = selectedCat && trendData?.market_counts?.[selectedCat]
    ? trendData.market_counts[selectedCat] : []
  const categoryTotals = trendData?.category_totals || {}
  const allCategoriesEmpty = (dict?.categories || []).length > 0
    && (dict?.categories || []).every((cat: any) => (categoryTotals[cat.id] || 0) === 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}>
        <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
          <strong>网络环境提示：</strong>趋势数据采集需要 VPN 环境。数据中的产品可加入选品库。
        </span>
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>品类趋势</p>
          </div>
          <CategoryPillsBar categories={dict?.categories || []} selected={selectedCat} onChange={setSelectedCat} totals={trendData?.category_totals} />
          {allCategoriesEmpty && (
            <div className="mt-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
              当前品类趋势均为 0，表示系统还没有真实同步或人工录入的趋势关键词；可先使用下方市场卡片“添加关键词”，或到品源管理趋势层同步 Google Trends / Pinterest 数据。
            </div>
          )}
        </CardContent>
      </Card>
      <EvidenceBanner evidence={trendEvidence} />
      {/* Market filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>市场筛选:</span>
        <button onClick={() => setSelectedMarket('')}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!selectedMarket ? 'text-[var(--color-primary-text)] border-transparent' : 'text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]'}`}
          style={!selectedMarket ? { background: 'var(--gradient-accent)' } : {}}>全部</button>
        {(dict?.markets || []).map((m: any) => (
          <button key={m.id}
            onClick={() => setSelectedMarket(selectedMarket === m.id ? '' : m.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedMarket === m.id ? 'text-[var(--color-primary-text)] border-transparent' : 'text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]'}`}
            style={selectedMarket === m.id ? { background: 'var(--gradient-accent)' } : {}}>
            {m.flag || ''} {m.label}
          </button>
        ))}
      </div>
      {trendError && (
        <Card><CardContent className="pt-4"><div className="flex flex-col items-center gap-3 py-6 text-center">
          <TriangleAlert className="w-8 h-8 text-[var(--color-danger)]" />
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{trendError}</p>
          <button onClick={() => { setTrendError(null); setTrendLoading(true); refreshData().finally(() => setTrendLoading(false)) }}
            className="px-4 py-1.5 text-xs rounded-lg text-[var(--color-primary-text)]" style={{ background: 'var(--color-primary)' }}>重新加载</button>
        </div></CardContent></Card>
      )}
      {trendLoading && !trendData && !trendError && (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--color-border)' }} />)}</div>
      )}
      {!trendError && selectedCat && (
        <div className="space-y-6">
          {(dict?.markets || []).filter((m: any) => !selectedMarket || (m.id || m.market) === selectedMarket).map((m: any) => {
            const mktId = m.id || m.market
            const apiMkt = categoryMarkets.find((cm: any) => cm.market === mktId)
            const kws = apiMkt ? (trendData?.by_category?.[selectedCat]?.[mktId] || []).slice(0, 20) : []
            const count = apiMkt?.count || 0
            return (
              <div key={mktId}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{m.flag || ''}</span>
                  <h2 className="text-base font-semibold" style={{ color: 'var(--color-fg)' }}>{m.label}</h2>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{count}个关键词</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {kws.map((kw: any) => {
                    const dir = DIR_LABEL[kw.trend_direction] || DIR_LABEL.stable
                    return (
                      <Card key={kw.id} className="hover:shadow-md transition-shadow relative card-lift">
                        <button onClick={async () => {
                              try { await deleteCapturedKeyword(kw.id); refreshData() } catch (e: any) { logger.error('Delete captured keyword failed', e) }
                        }} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-danger-light)] text-[var(--color-muted)] hover:text-[var(--color-danger)] z-10" title="删除">
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <CardContent className="pt-3 px-3.5 pb-3">
                          <div className="flex items-start justify-between mb-1.5 pr-5">
                            <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-fg)' }}>{kw.keyword}</p>
                            <span className="text-sm font-bold shrink-0 ml-2 min-w-[18px] text-right" style={{ color: 'var(--color-primary)' }}>
                              {kw.search_volume != null
                                ? `量 ${Math.round(kw.search_volume)}`
                                : kw.trend_index != null
                                  ? `指数 ${Math.round(kw.trend_index)}`
                                  : '-'}
                            </span>
                          </div>
                          <TrendLine values={kw.trend_data} />
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ color: dir.label === '上升' ? 'var(--color-success)' : dir.label === '下降' ? 'var(--color-danger)' : 'var(--color-warning)' }}>{dir.icon}{dir.label}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: kw.growth_pct != null ? (kw.growth_pct > 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)' }}>{kw.growth_pct != null ? `${kw.growth_pct > 0 ? '+' : ''}${kw.growth_pct.toFixed(0)}%` : '--%'}</span>
                            <span className="ml-auto flex items-center gap-1.5 shrink-0">
                              <button onClick={async () => {
                                try {
                                  await addToSourcing({ source_name: 'trend_keyword', source_type: 'trend_hotspot', product_name: kw.keyword, category: selectedCat, market: mktId, notes: `趋势热点: ${kw.keyword}` })
                                  toast.addToast('success', '已添加到选品列表 → 趋势热点')
                                } catch (e: any) {
                                  logger.error('Add trend keyword to sourcing failed', e)
                                  toast.addToast('error', `添加失败：${e?.response?.data?.detail || e.message}`)
                                }
                              }} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }} title="添加到选品列表的趋势热点">+添加</button>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                <Card className="hover:shadow-md transition-shadow min-h-[100px]">
                  <CardContent className="pt-3 px-3.5 pb-3">
                  {addMarket === mktId ? (
                    <div>
                      <input type="text" autoFocus placeholder={`添加${m.label}关键词...`}
                        className="w-full text-xs border rounded-lg px-2 py-1 outline-none mb-2" style={{ borderColor: 'var(--color-primary)' }}
                        value={addForm.keyword} onChange={e => setAddForm({...addForm, keyword: e.target.value})}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddKeyword(mktId) }} />
                      <div className="flex items-center justify-between"><button onClick={() => handleAddKeyword(mktId)} disabled={adding || !addForm.keyword.trim()} className="text-[11px] px-2.5 py-1 rounded text-[var(--color-primary-text)] disabled:opacity-40" style={{ background: 'var(--color-primary)' }}>{adding ? '...' : '确认'}</button><button onClick={() => { setAddMarket(null); setAddForm({ keyword: '', search_volume: '', growth_pct: '' }) }} className="text-[11px] px-2 py-1 rounded" style={{ color: 'var(--color-muted)' }}>取消</button></div>
                    </div>
                  ) : (
                    <div onClick={() => setAddMarket(mktId)} className="text-center cursor-pointer py-3"><Plus className="w-5 h-5 mx-auto" style={{ color: 'var(--color-border)' }} /><p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>添加关键词</p></div>
                  )}
                  </CardContent>
                </Card>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!trendError && !selectedCat && (
        <Card><CardContent className="pt-4 text-center py-12" style={{ color: 'var(--color-muted)' }}>
          <TrendingUp className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">选择一个品类查看已添加的趋势关键词</p>
        </CardContent></Card>
      )}
    </div>
  )
}

function CategoryPillsBar({ categories, selected, onChange, totals }: {
  categories: DictCategory[]; selected: string; onChange: (id: string) => void; totals?: Record<string, number>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat: any) => {
        const catId = cat.id; const total = totals?.[catId] || 0
        return (
          <button key={catId} onClick={() => onChange(catId)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all"
            style={{ background: selected === catId ? 'var(--color-primary)' : 'var(--color-border)', color: selected === catId ? 'var(--color-primary-text)' : 'var(--color-muted)' }}>
            <span>{cat.icon || '📦'}</span><span>{cat.label || catId}</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[11px] font-bold px-1"
              style={{ background: selected === catId ? 'var(--color-active-overlay)' : 'var(--color-bg)' }}>{total}</span>
          </button>
        )
      })}
    </div>
  )
}


/* ============================== Upload Tab ============================== */
