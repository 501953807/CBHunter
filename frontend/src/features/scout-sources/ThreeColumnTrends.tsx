import { useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowDown, ArrowUp, Info, Minus, TrendingUp } from 'lucide-react'
import { createScoutSignal } from '../../api/scout'
import { Badge } from '../../components/ui/Badge'
import { Card, CardContent } from '../../components/ui/Card'
import { logger } from '../../utils/logger'

type Props = {
  trendKeywords: any[]
  setTrendKeywords: Dispatch<SetStateAction<any[]>>
  addingKeyword: string | null
  setAddingKeyword: (id: string | null) => void
  marketOptions: any[]
}

const DIRECTIONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  rising: { icon: <ArrowUp className="w-3 h-3" />, label: '上升', color: 'var(--color-success)' },
  falling: { icon: <ArrowDown className="w-3 h-3" />, label: '下降', color: 'var(--color-danger)' },
  stable: { icon: <Minus className="w-3 h-3" />, label: '平稳', color: 'var(--color-warning)' },
}

function TrendLine({ values }: { values: number[] }) {
  const blocks = '▁▂▃▄▅▆▇█'
  if (!values?.length) return <span className="text-xs tracking-[0.5px] text-[var(--color-border)] font-mono">{'▁'.repeat(14)}</span>
  const max = Math.max(...values, 1)
  return <span className="text-xs tracking-[0.5px] text-[var(--color-muted)] font-mono">{values.map(value => blocks[Math.min(Math.floor((value / max) * (blocks.length - 1)), blocks.length - 1)]).join('')}</span>
}

export function ThreeColumnTrends({ trendKeywords, setTrendKeywords, addingKeyword, setAddingKeyword, marketOptions }: Props) {
  const [manualKeyword, setManualKeyword] = useState('')
  const [manualMarket, setManualMarket] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const google = trendKeywords.filter(keyword => keyword.source === 'google_trends' || (!keyword.source && !keyword.has_pinterest_data))
  const pinterest = trendKeywords.filter(keyword => keyword.source === 'pinterest')
  const cross = trendKeywords.filter(keyword => keyword.source === 'cross' || (keyword.has_pinterest_data && (keyword.cross_validation_score || 0) >= 60))
  const overlap = google.length > 0 ? Math.round((cross.length / google.length) * 100) : 0
  const marketLabels = new Map(marketOptions.map(market => [market.id, `${market.flag ? `${market.flag} ` : ''}${market.label}`]))

  const handleAdd = async (keyword: any) => {
    const id = keyword.id || keyword.keyword
    setAddingKeyword(id)
    try {
      await createScoutSignal({
        source_id: keyword.has_pinterest_data ? 'pinterest_cross' : 'google_trends',
        keyword: keyword.keyword,
        product_idea: keyword.keyword,
        heat_level: keyword.search_volume || undefined,
        market: keyword.market || undefined,
        category: keyword.category || '',
        search_volume: keyword.search_volume,
        trend_direction: keyword.trend_direction || 'rising',
        growth_pct: keyword.growth_pct,
        competition_level: keyword.competition_level || undefined,
      })
      setTrendKeywords(previous => previous.filter(item => item.id !== keyword.id))
    } catch (e: any) {
      logger.error('Failed to add keyword signal', e)
    }
    setAddingKeyword(null)
  }

  const handleManualAdd = async () => {
    const keyword = manualKeyword.trim()
    if (!keyword) return
    setManualSaving(true)
    try {
      await createScoutSignal({
        source_id: 'google_trends',
        keyword,
        product_idea: keyword,
        market: manualMarket || undefined,
        trend_direction: 'rising',
      })
      setTrendKeywords(previous => [
        { id: `manual-${Date.now()}`, keyword, market: manualMarket || undefined, source: 'manual', trend_direction: 'rising' },
        ...previous,
      ])
      setManualKeyword('')
    } catch (e: any) {
      logger.error('Failed to add manual trend keyword', e)
    }
    setManualSaving(false)
  }

  const renderCard = (keyword: any, showScore = false) => {
    const direction = DIRECTIONS[keyword.trend_direction] || DIRECTIONS.stable
    const isAdding = addingKeyword === (keyword.id || keyword.keyword)
    return (
      <Card key={keyword.id || keyword.keyword} className="hover:shadow-md transition-shadow">
        <CardContent className="pt-3 px-3.5 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-medium truncate text-[var(--color-fg)]">{keyword.keyword}</p>
            {showScore
              ? <Badge variant={keyword.cross_validation_score >= 60 ? 'success' : 'warning'} className="text-[11px]">{keyword.cross_validation_score || 0}分</Badge>
              : <span className="text-sm font-bold text-[var(--color-primary)]">
                  {keyword.search_volume != null
                    ? `量 ${Math.round(keyword.search_volume)}`
                    : keyword.trend_index != null
                      ? `指数 ${Math.round(keyword.trend_index)}`
                      : '-'}
                </span>}
          </div>
          <TrendLine values={keyword.trend_data} />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs inline-flex items-center gap-0.5" style={{ color: direction.color }}>{direction.icon}{direction.label}</span>
            <span className="text-xs" style={{ color: keyword.growth_pct > 0 ? 'var(--color-success)' : keyword.growth_pct < 0 ? 'var(--color-danger)' : 'var(--color-muted)' }}>
              {keyword.growth_pct != null ? `${keyword.growth_pct > 0 ? '+' : ''}${Number(keyword.growth_pct).toFixed(0)}%` : '--%'}
            </span>
            <span className="text-[11px] text-[var(--color-muted)] ml-auto">{keyword.market ? marketLabels.get(keyword.market) || keyword.market : ''}</span>
            <button onClick={() => handleAdd(keyword)} disabled={isAdding} className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-success-light)] text-[var(--color-success)] disabled:opacity-30">
              {isAdding ? '...' : '+热词'}
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderColumn = (title: string, items: any[], description: string, showScore = false) => (
    <div className="flex h-full min-w-0 flex-col space-y-3 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center gap-2 shrink-0">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
        <span className="text-xs text-[var(--color-muted)]">{items.length}个</span>
        <span className="relative ml-auto group">
          <Info className="w-3.5 h-3.5 cursor-help text-[var(--color-muted)]" />
          <span className="absolute right-0 top-5 w-56 p-2.5 rounded-lg shadow-lg border border-[var(--color-border)] text-[11px] leading-relaxed z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto bg-[var(--color-surface)] text-[var(--color-muted)]">{description}</span>
        </span>
      </div>
      {showScore && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2 text-center bg-[var(--color-bg)]"><p className="text-lg font-bold text-[var(--color-primary)]">{items.length}</p><p className="text-[11px] text-[var(--color-muted)]">重合关键词</p></div>
          <div className="rounded-lg p-2 text-center bg-[var(--color-bg)]"><p className="text-lg font-bold text-[var(--color-success)]">{overlap}%</p><p className="text-[11px] text-[var(--color-muted)]">重合度</p></div>
        </div>
      )}
      <div className="grid gap-2">
        {items.map(keyword => renderCard(keyword, showScore))}
        {items.length === 0 && <div className="text-center py-8"><TrendingUp className="w-8 h-8 mx-auto mb-2 text-[var(--color-muted)]" /><p className="text-xs text-[var(--color-muted)]">暂无数据</p></div>}
      </div>
    </div>
  )

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-[11px] text-[var(--color-muted)]">
            手工录入趋势关键词
            <input value={manualKeyword} onChange={event => setManualKeyword(event.target.value)} placeholder="例如：portable blender"
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)]" />
          </label>
          <label className="w-40 text-[11px] text-[var(--color-muted)]">
            市场
            <select value={manualMarket} onChange={event => setManualMarket(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)]">
              <option value="">未限定</option>
              {marketOptions.map(market => <option key={market.id} value={market.id}>{marketLabels.get(market.id) || market.label}</option>)}
            </select>
          </label>
          <button onClick={handleManualAdd} disabled={manualSaving || !manualKeyword.trim()}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-[var(--color-primary-text)] disabled:opacity-40">
            {manualSaving ? '添加中' : '添加为趋势信号'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">用于没有同步数据时手工补充趋势种子；系统只记录为人工信号，不生成虚构搜索量。</p>
      </div>
      <div className="grid min-h-[60vh] gap-4 xl:grid-cols-3">
        {renderColumn('Google Trends', google, 'Google 搜索趋势数据，反映关键词搜索热度和变化。')}
        {renderColumn('Pinterest Trends', pinterest, 'Pinterest 图片搜索趋势数据，反映用户对产品视觉风格的兴趣。')}
        {renderColumn('交叉热点', cross, 'Google Trends 与 Pinterest 同时出现的关键词，评分越高越值得验证。', true)}
      </div>
    </div>
  )
}
