import { useState, useEffect } from 'react'
import { TrendingUp, Globe, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useConfig } from '../../hooks/useConfig'
import { listTrends } from '../../api/discovery'
import { addToSourcing } from '../../api/sourcing'
import { logger } from '../../utils/logger'

const DIR_LABEL: Record<string, { icon: React.ReactNode; label: string }> = {
  rising: { icon: <ArrowUp className="w-3 h-3" />, label: '上升' },
  falling: { icon: <ArrowDown className="w-3 h-3" />, label: '下降' },
  stable: { icon: <Minus className="w-3 h-3" />, label: '平稳' } }

function TrendLine({ values }: { values: number[] }) {
  const blocks = '▁▂▃▄▅▆▇█'
  if (!values || values.length === 0) return <span className="text-xs tracking-[0.5px] font-mono" style={{ color: 'var(--color-border)' }}>{'▁'.repeat(14)}</span>
  const max = Math.max(...values, 1)
  const chars = values.map(v => blocks[Math.min(Math.floor((v / max) * (blocks.length - 1)), blocks.length - 1)])
  return <span className="text-xs tracking-[0.5px] text-[var(--color-muted)] font-mono">{chars.join('')}</span>
}

export function TrendsTab() {
  const { categories } = useConfig()
  const [trendData, setTrendData] = useState<any>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [selectedCat, setSelectedCat] = useState<string>('')

  const refreshData = async () => {
    setTrendError(null)
    try {
      const res = await listTrends({ consumed_only: true })
      if (res.data) setTrendData(res.data)
    } catch (e: any) {
      setTrendError(e?.response?.data?.detail || e?.message || '加载趋势数据失败')
    }
  }

  useEffect(() => {
    (async () => {
      setTrendLoading(true)
      try {
        const res = await listTrends({ consumed_only: true })
        if (res.data) {
          const d = res.data as any
          setTrendData(d)
          if (d.categories?.length > 0) setSelectedCat(d.categories[0])
          else if (categories.length > 0) setSelectedCat(categories[0].id)
        }
        setTrendError(null)
      } catch (e: any) {
        setTrendError(e?.response?.data?.detail || e?.message || '加载趋势数据失败')
      }
      setTrendLoading(false)
    })()
  }, [categories])

  // Compute cross-validation when trendData changes
  const googleKeywords = trendData?.keywords_by_source?.google_trends || []
  const pinterestKeywords = trendData?.keywords_by_source?.pinterest || []

  // Filter by selected category
  const filterByCat = (kws: any[]) => selectedCat ? kws.filter((k: any) => k.category === selectedCat || !k.category) : kws
  const filteredGoogle = filterByCat(googleKeywords)
  const filteredPinterest = filterByCat(pinterestKeywords)

  // Compute cross overlap
  const googleSet = new Set(filteredGoogle.map((k: any) => k.keyword?.toLowerCase()))
  const overlapKws = filteredPinterest.filter((p: any) => googleSet.has(p.keyword?.toLowerCase()))
  const overlapPct = filteredGoogle.length > 0 ? Math.round((overlapKws.length / filteredGoogle.length) * 100) : 0

  const handleAddToSourcing = async (kw: any, market?: string) => {
    try {
      await addToSourcing({
        source_name: kw.source_name || 'trend_keyword',
        source_type: 'trend_hotspot',
        product_name: kw.keyword,
        category: selectedCat,
        market: market || kw.market || '',
        notes: `趋势热点: ${kw.keyword} | 趋势指数: ${kw.trend_index ?? '-'}`,
      })
    } catch (e: any) { logger.error('Add trend keyword to sourcing failed', e) }
  }

  const activeCategories = categories.length > 0 ? categories : (trendData?.categories || []).map((c: string) => ({ id: c, label: c, icon: '📦' }))

  if (trendLoading && !trendData) {
    return <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--color-border)' }} />)}</div>
  }

  if (trendError && !trendData) {
    return (
      <Card><CardContent className="pt-4"><div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{trendError}</p>
        <button onClick={() => { setTrendError(null); setTrendLoading(true); refreshData().finally(() => setTrendLoading(false)) }}
          className="px-4 py-1.5 text-xs rounded-lg text-[var(--color-primary-text)]" style={{ background: 'var(--color-primary)' }}>重新加载</button>
      </div></CardContent></Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Network hint */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)' }}>
        <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <span className="text-xs" style={{ color: 'var(--color-primary)' }}>
          <strong>网络环境提示：</strong>趋势数据采集需要 VPN 环境。数据中的产品可加入选品库。
        </span>
      </div>

      {/* Shared category filter — ABOVE the 3 columns */}
      <Card>
        <CardContent className="pt-3 pb-3">
          <div className="flex flex-wrap gap-2">
            {activeCategories.map((cat: any) => {
              const catId = cat.id
              const total = trendData?.category_totals?.[catId] || 0
              return (
                <button key={catId} onClick={() => setSelectedCat(catId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: selectedCat === catId ? 'var(--color-primary)' : 'var(--color-border)',
                    color: selectedCat === catId ? 'var(--color-primary-text)' : 'var(--color-muted)',
                  }}>
                  <span>{cat.icon || '📦'}</span><span>{cat.label || catId}</span>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[11px] font-bold px-1"
                    style={{ background: selectedCat === catId ? 'var(--color-active-overlay)' : 'var(--color-bg)' }}>{total}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Three column layout — keyword cards */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 'calc(100vh - 380px)' }}>
        {/* Column 1: Google Trends Keywords */}
        <div className="flex flex-col space-y-3 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg">🔍</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Google Trends</h3>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{filteredGoogle.length}个</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {filteredGoogle.map((kw: any) => (
              <KeywordCard key={kw.id} kw={kw} onAddToSourcing={handleAddToSourcing} />
            ))}
            {filteredGoogle.length === 0 && <EmptyColumn text="暂无 Google Trends 关键词" />}
          </div>
        </div>

        {/* Column 2: Pinterest Keywords */}
        <div className="flex flex-col space-y-3 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg">📌</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>Pinterest Trends</h3>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{filteredPinterest.length}个</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {filteredPinterest.map((kw: any) => (
              <KeywordCard key={kw.id} kw={kw} onAddToSourcing={handleAddToSourcing} />
            ))}
            {filteredPinterest.length === 0 && <EmptyColumn text="暂无 Pinterest 关键词" />}
          </div>
        </div>

        {/* Column 3: Cross Validation (Google ∩ Pinterest) */}
        <div className="flex flex-col space-y-3 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg">⚡</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>交叉热点</h3>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{overlapKws.length}个重合</span>
          </div>

          {/* Overlap stats */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--color-bg)' }}>
              <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{overlapKws.length}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>重合关键词</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'var(--color-bg)' }}>
              <p className="text-lg font-bold" style={{ color: overlapPct > 30 ? 'var(--color-success)' : 'var(--color-warning)' }}>{overlapPct}%</p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>重合度</p>
            </div>
          </div>

          {overlapPct > 30 && (
            <div className="rounded-lg px-3 py-2 text-xs font-medium shrink-0" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
              双源重合度较高，仍需结合竞品、成本和利润验证
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {overlapKws.map((kw: any) => (
              <Card key={kw.id || kw.keyword} className="hover:shadow-md transition-shadow card-lift">
                <CardContent className="pt-3 px-3.5 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>{kw.keyword}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default" className="text-[11px]">GT 指数 {kw.trend_index ?? '-'}</Badge>
                        <span className="text-[11px]" style={{ color: 'var(--color-accent)' }}>Pinterest ✓</span>
                      </div>
                    </div>
                    <button onClick={() => handleAddToSourcing(kw)}
                      className="text-[11px] px-2 py-1 rounded shrink-0 hover:opacity-80"
                      style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                      +选品
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {overlapKws.length === 0 && <EmptyColumn text="暂无重合关键词" />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Shared keyword card — matches original trend keyword card style */
function KeywordCard({ kw, onAddToSourcing }: {
  kw: any; onAddToSourcing: (kw: any, market?: string) => void;
}) {
  const hasData = kw.last_fetched_at != null
  const dir = DIR_LABEL[kw.trend_direction] || DIR_LABEL.stable

  return (
    <Card className="hover:shadow-md transition-shadow relative card-lift">
      <CardContent className="pt-3 px-3.5 pb-3">
        <div className="flex items-start justify-between mb-1.5 pr-5">
          <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-fg)' }}>{kw.keyword}</p>
          <span className="text-sm font-bold shrink-0 ml-2 min-w-[18px] text-right" style={{ color: 'var(--color-primary)' }}>
            {hasData
              ? kw.search_volume != null
                ? `量 ${Math.round(kw.search_volume)}`
                : kw.trend_index != null
                  ? `指数 ${Math.round(kw.trend_index)}`
                  : '-'
              : '-'}
          </span>
        </div>
        <TrendLine values={kw.trend_data} />
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded"
            style={{ color: dir.label === '上升' ? 'var(--color-success)' : dir.label === '下降' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            {dir.icon}{dir.label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: kw.growth_pct != null ? (kw.growth_pct > 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--color-muted)' }}>
            {kw.growth_pct != null ? `${kw.growth_pct > 0 ? '+' : ''}${kw.growth_pct.toFixed(0)}%` : '--%'}
          </span>
          <button onClick={() => onAddToSourcing(kw, kw.market)}
            className="ml-auto text-[11px] px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
            +选品
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyColumn({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-muted)' }} />
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{text}</p>
    </div>
  )
}
