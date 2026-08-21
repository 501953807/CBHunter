import { useState } from 'react'
import { Search, Globe, AlertCircle, Loader2 } from 'lucide-react'
import { searchRadar } from '../api/smart'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { ApiResponse } from '../types/common'

interface RadarResult {
  keyword: string
  market: string
  competition_score: number | null
  total_results: number | null
  avg_price: number | null
  avg_sold: number | null
  avg_rating: number | null
  top_shop_share: number | null
  is_blue_ocean: boolean
  recommendation: string
  error?: string
}

export default function SmartRadarPage() {
  const { markets } = useConfig()
  const [keywordInput, setKeywordInput] = useState('')
  const [market, setMarket] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RadarResult[]>([])
  const [error, setError] = useState('')
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)

  const handleSearch = async () => {
    const keywords = keywordInput.split('\n').map(k => k.trim()).filter(Boolean)
    if (keywords.length === 0 || !market) return
    if (keywords.length > 20) {
      setError('单次最多分析 20 个关键词')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      const res = await searchRadar(keywords, market)
      setResults(res.data?.results || [])
      setEvidence(res)
    } catch (e: unknown) {
      logger.error('Smart radar search failed', e)
      setError(responseErrorMessage(e, '分析失败，请重试'))
    }
    setLoading(false)
  }

  const getScoreColor = (score: number | null) => {
    if (score == null) return { bg: 'bg-[var(--color-bg)]', text: 'text-[var(--color-muted)]', border: 'border-[var(--color-border)]', label: '数据不足' }
    if (score >= 65) return { bg: 'bg-[var(--color-success-light)]', text: 'text-[var(--color-success)]', border: 'border-[var(--color-success)]', label: '低竞争信号' }
    if (score >= 40) return { bg: 'bg-[var(--color-primary-light)]', text: 'text-[var(--color-primary)]', border: 'border-[var(--color-primary)]', label: '中等' }
    return { bg: 'bg-[var(--color-danger-light)]', text: 'text-[var(--color-danger)]', border: 'border-[var(--color-danger)]', label: '红海' }
  }

  return (
    <div className="smart-scout-tool-page smart-radar-workbench page-enter space-y-6">
      <section className="smart-tool-hero">
        <div>
          <span className="smart-tool-eyebrow">Keyword intelligence</span>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-fg)' }}>关键词雷达</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            实时扫描 Shopee 搜索关键词的竞争态势，结果仅作为进一步验证信号
          </p>
        </div>
        <div className="smart-tool-hero-metrics" aria-label="关键词雷达约束">
          <span>≤ 20 关键词</span>
          <span>2-5 秒间隔</span>
          <span>真实接口优先</span>
        </div>
      </section>

      {/* Input area */}
      <div className="smart-tool-input-panel rounded-xl border p-4 mb-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="smart-tool-input-toolbar flex items-center gap-3 mb-3">
          <Globe className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          <select
            value={market}
            onChange={e => setMarket(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border bg-transparent"
            style={{ color: 'var(--color-fg)', borderColor: 'var(--color-border)' }}
          >
            <option value="">请选择市场</option>
            {markets.map(m => (
              <option key={m.id} value={m.id}>{m.flag ? `${m.flag} ` : ''}{m.label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={keywordInput}
          onChange={e => setKeywordInput(e.target.value)}
          placeholder="输入关键词，每行一个&#10;例如：&#10;bluetooth earphone&#10;women bag&#10;kpop photocard"
          rows={5}
          className="w-full text-sm px-3 py-2 rounded-lg border resize-none"
          style={{ color: 'var(--color-fg)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        />
        <div className="smart-tool-action-row flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {keywordInput.split('\n').filter(Boolean).length} 个关键词 · 每次搜索间隔 2-5 秒
          </span>
          <button
            onClick={handleSearch}
            disabled={loading || !keywordInput.trim() || !market}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-[var(--color-primary-text)] disabled:opacity-40 transition-all"
            style={{ background: loading ? 'var(--color-muted)' : 'var(--gradient-accent)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? '分析中...' : '开始扫描'}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-[var(--color-danger)]">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>
      <EvidenceBanner evidence={evidence} compact />

      {/* Results */}
      {results.length > 0 && (
        <section className="smart-tool-results space-y-3" aria-label="关键词扫描结果">
          {results.map((r, i) => {
            const colors = getScoreColor(r.competition_score)
            return (
              <div
                key={i}
                className={`smart-tool-result-card rounded-xl border p-4 ${colors.border} transition-all hover:shadow-md`}
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>
                      {r.keyword}
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>市场: {r.market}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                    {colors.label}{r.competition_score == null ? '' : ` · ${r.competition_score}分`}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <Metric label="竞品总数" value={r.total_results == null ? '-' : r.total_results.toLocaleString()} />
                  <Metric label="均价" value={r.avg_price ? `¥${r.avg_price.toFixed(2)}` : '-'} />
                  <Metric label="平均销量" value={r.avg_sold ? r.avg_sold.toLocaleString() : '-'} />
                  <Metric label="头部占比" value={r.top_shop_share ? `${(r.top_shop_share * 100).toFixed(0)}%` : '-'} />
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                  {r.recommendation}
                </p>
              </div>
            )
          })}
        </section>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="smart-tool-empty-state text-center py-16" style={{ color: 'var(--color-muted)' }}>
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">输入关键词开始扫描 Shopee 市场</p>
        </div>
      )}
    </div>
  )
}

function responseErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    return response?.data?.detail || fallback
  }
  return fallback
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="smart-tool-metric text-center px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>{value}</div>
      <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</div>
    </div>
  )
}
