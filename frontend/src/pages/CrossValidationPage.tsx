import { useState } from 'react'
import { GitCompare, Globe, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { crossValidate1688 } from '../api/smart'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { ApiResponse } from '../types/common'

interface CrossResult {
  keyword_1688: string
  source_category: string
  cross_border_category: string
  popularity_1688: number | null
  shopee_total_products: number | null
  shopee_competition_score: number | null
  shopee_avg_price: number | null
  cross_validation_score: number | null
  is_opportunity: boolean
  market: string
  recommendation: string
}

export default function CrossValidationPage() {
  const { markets } = useConfig()
  const [market, setMarket] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CrossResult[]>([])
  const [error, setError] = useState('')
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)

  const handleAnalyze = async () => {
    if (!market) return
    setLoading(true)
    setError('')
    try {
      const res = await crossValidate1688({ market, limit: 30 })
      setResults(res.data?.results || [])
      setEvidence(res)
    } catch (e: unknown) {
      logger.error('Cross validate 1688 failed', e)
      setError(responseErrorMessage(e, '分析失败'))
    }
    setLoading(false)
  }

  const getOpportunityLabel = (score: number | null, isOpp: boolean) => {
    if (score == null) return { text: '数据不完整', cls: 'bg-[var(--color-bg)] text-[var(--color-muted)]' }
    if (isOpp) return { text: '交叉信号较强', cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' }
    if (score >= 40) return { text: '可关注', cls: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' }
    return { text: '待观察', cls: 'bg-[var(--color-bg)] text-[var(--color-muted)]' }
  }

  return (
    <div className="smart-scout-tool-page cross-validation-workbench page-enter space-y-6">
      <section className="smart-tool-hero">
        <div>
          <span className="smart-tool-eyebrow">Supply × market proof</span>
          <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-fg)' }}>1688 × Shopee 交叉验证</h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            从 1688 热搜词出发，实时对比 Shopee 竞争态势。1688 高热度 + Shopee 低竞争 = 选品强信号
          </p>
        </div>
        <div className="smart-tool-hero-metrics" aria-label="交叉验证步骤">
          <span>1688 热词</span>
          <span>Shopee 竞争</span>
          <span>机会排序</span>
        </div>
      </section>

      <div className="smart-tool-input-panel rounded-xl border p-4 mb-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="smart-tool-input-toolbar flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
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
          <button
            onClick={handleAnalyze}
            disabled={loading || !market}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-[var(--color-primary-text)] disabled:opacity-40"
            style={{ background: 'var(--gradient-accent)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
            {loading ? '交叉验证中 (约 1-2 分钟)...' : '开始交叉验证'}
          </button>
        </div>
        <p className="smart-tool-footnote text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
          将从 1688 发现热点词 → 逐一在 Shopee 搜索 → 计算竞争分 → 输出机会排名。预计耗时 1-2 分钟。
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm mb-4">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      <EvidenceBanner evidence={evidence} compact />

      {results.length > 0 && (
        <section className="smart-tool-results cross-validation-results space-y-3" aria-label="交叉验证结果">
          <div className="smart-tool-results-title text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
            发现 {results.length} 个候选词，按交叉验证得分排列
          </div>
          {results.map((r, i) => {
            const tag = getOpportunityLabel(r.cross_validation_score, r.is_opportunity)
            return (
              <div
                key={i}
                className="smart-tool-result-card rounded-xl border p-4 hover:shadow-md transition-all"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" style={{ color: 'var(--color-fg)' }}>{r.keyword_1688}</h3>
                      <a
                        href={`https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(r.keyword_1688)}&n=y`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        title="在 1688 搜索"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      1688类目: {r.source_category} → 跨境类目: {r.cross_border_category}
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tag.cls}`}>
                    {tag.text}{r.cross_validation_score == null ? '' : ` · ${r.cross_validation_score}分`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <MiniMetric label="1688热度" value={r.popularity_1688 ? `${r.popularity_1688}` : '-'} />
                  <MiniMetric label="Shopee竞品" value={r.shopee_total_products == null ? '-' : r.shopee_total_products.toLocaleString()} />
                  <MiniMetric label="Shopee均价" value={r.shopee_avg_price ? `¥${r.shopee_avg_price.toFixed(2)}` : '-'} />
                </div>

                <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{r.recommendation}</p>
              </div>
            )
          })}
        </section>
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="smart-tool-metric text-center px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{value}</div>
      <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</div>
    </div>
  )
}
