import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Database, PackageSearch, TriangleAlert } from 'lucide-react'
import { getRecommendations } from '../../api/recommender'
import { Card, CardContent } from '../../components/ui/Card'
import type { ProductRecommendation, RecommenderBundle } from '../../types/recommender'
import { logger } from '../../utils/logger'
import type { DictShape } from './TrendDiscoveryTypes'

const EVIDENCE_LABELS: Record<string, string> = {
  trend: '趋势',
  social: '社媒',
  platform: '平台',
  supply: '供应',
  profit: '利润',
  competitor: '竞品',
  content: '内容',
  risk: '风险',
}

const STATUS_LABELS: Record<string, string> = {
  present: '已具备',
  missing: '缺失',
  stale: '过期',
  low_confidence: '低置信',
}

function statusTone(status: string) {
  if (status === 'present') return 'var(--color-success)'
  if (status === 'low_confidence') return 'var(--color-warning)'
  if (status === 'stale') return 'var(--color-info)'
  return 'var(--color-danger)'
}

function decisionTone(level: string) {
  if (level === 'green') return 'var(--color-success)'
  if (level === 'yellow') return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function evidenceCompleteness(item: ProductRecommendation) {
  return item.evidence_completeness || {}
}

function evidenceSummary(item: ProductRecommendation) {
  const completeness = evidenceCompleteness(item)
  const fallback = Object.values(completeness).reduce((acc, status) => ({
    ...acc,
    total: acc.total + 1,
    present: acc.present + (status === 'present' ? 1 : 0),
    missing: acc.missing + (status === 'missing' ? 1 : 0),
    stale: acc.stale + (status === 'stale' ? 1 : 0),
    low_confidence: acc.low_confidence + (status === 'low_confidence' ? 1 : 0),
  }), { total: 0, present: 0, missing: 0, stale: 0, low_confidence: 0 })
  return {
    ...fallback,
    ...(item.evidence_summary || {}),
  }
}

function safeTextList(value?: string[]) {
  return Array.isArray(value) ? value : []
}

function EvidenceChips({ item }: { item: ProductRecommendation }) {
  const entries = Object.entries(evidenceCompleteness(item))
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--color-warning)]">证据矩阵待补齐</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, status]) => (
        <span
          key={key}
          className="rounded-full border px-2 py-0.5 text-[11px]"
          style={{ borderColor: statusTone(status), color: statusTone(status) }}
        >
          {EVIDENCE_LABELS[key] || key}：{STATUS_LABELS[status] || status}
        </span>
      ))}
    </div>
  )
}

function RecommendationCard({ item, onDecide }: { item: ProductRecommendation; onDecide: (item: ProductRecommendation) => void }) {
  const summary = evidenceSummary(item)
  const keywords = safeTextList(item.keywords)
  const listingTips = safeTextList(item.listing_tips)
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:shadow-sm transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</h4>
            <span
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: decisionTone(item.decision_level), color: decisionTone(item.decision_level) }}
            >
              {item.decision_label}
            </span>
            <span className="rounded-full bg-[var(--color-accent-light)] px-2 py-0.5 text-[11px] text-[var(--color-accent)]">
              {item.lifecycle_label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {item.work_item_id} · {item.target_platform} / {item.target_market}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--color-fg)]">{item.score}</p>
          <p className="text-[11px] text-[var(--color-muted)]">证据评分</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <Metric label="需求" value={item.demand_level} />
        <Metric label="利润" value={item.profit_potential} />
        <Metric label="竞品" value={item.competition_level} />
        <Metric label="证据" value={`${summary.present}/${summary.total}`} />
      </div>

      <ProductContext item={item} />

      <div className="mt-3">
        <EvidenceChips item={item} />
      </div>

      {keywords.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          关键词：{keywords.join('、')}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--color-fg)]">{item.decision_action}</p>
      <button
        onClick={() => onDecide(item)}
        className="mt-3 inline-flex items-center rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
      >
        进入选品决策
      </button>
      {listingTips.length > 0 && (
        <p className="mt-1 text-xs text-[var(--color-warning)]">待补：{listingTips.join('、')}</p>
      )}
      {item.experience_notes?.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {item.experience_notes.map((note) => (
            <div key={`${item.work_item_id}-${note.type}`} className="rounded-lg bg-[var(--color-bg)] p-2">
              <p className="text-[11px] font-medium text-[var(--color-fg)]">{note.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProductContext({ item }: { item: ProductRecommendation }) {
  const context = item.product_context
  if (!context) return null
  const facts = [
    ['品类', context.category || '未归类'],
    ['趋势搜索量', formatValue(context.trend?.search_volume)],
    ['趋势方向', context.trend?.trend_direction || (context.trend?.seasonal ? 'seasonal' : '未标记')],
    ['平台均价', formatValue(context.pricing?.avg_price_local)],
    ['采购价', context.pricing?.suggested_sourcing_price_rmb || '待补'],
    ['证据源', `${context.evidence?.source_ref_count || 0} 个`],
  ]

  return (
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="grid gap-2 md:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
            <p className="text-[11px] font-medium text-[var(--color-fg)]">{value}</p>
          </div>
        ))}
      </div>
      {context.evidence?.evidence_window && (
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">
          证据窗口：{context.evidence.evidence_window}
        </p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-2 py-1.5">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="text-xs font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function formatValue(value?: number | null) {
  if (value === null || value === undefined) return '待补'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

export function RecommendationEvidencePanel({ dict }: { dict: DictShape }) {
  const navigate = useNavigate()
  const platforms = dict?.platforms || []
  const markets = dict?.markets || []
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [bundle, setBundle] = useState<RecommenderBundle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!platform && platforms[0]?.id) setPlatform(platforms[0].id)
    if (!market && markets[0]?.id) setMarket(markets[0].id)
  }, [market, markets, platform, platforms])

  useEffect(() => {
    if (!platform || !market) return
    let cancelled = false
    setLoading(true)
    setError('')
    getRecommendations(platform, market).then((response) => {
      if (!cancelled) setBundle(response.data || null)
    }).catch((e: any) => {
      logger.error('真实证据推荐加载失败', e)
      if (!cancelled) setError(e?.response?.data?.detail || e?.message || '加载失败')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [market, platform])

  const recommendations = bundle?.recommendations || []
  const openDecision = (item: ProductRecommendation) => {
    navigate(`/product-selection?candidate_id=${encodeURIComponent(item.work_item_id)}&platform=${encodeURIComponent(item.target_platform || platform)}&market=${encodeURIComponent(item.target_market || market)}`)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">真实证据推荐候选</h3>
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)]">
            <option value="">选择平台</option>
            {platforms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={market} onChange={(e) => setMarket(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)]">
            <option value="">选择市场</option>
            {markets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Database className="h-4 w-4 animate-pulse" /> 正在读取真实证据并生成候选推荐...
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-danger)]">
            <TriangleAlert className="h-4 w-4" /> {error}
          </div>
        )}
        {!loading && !error && bundle?.status === 'data_required' && (
          <div className="flex items-start gap-2 text-xs text-[var(--color-warning)]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{bundle.note || '真实证据不足，暂不能生成推荐。'}</span>
          </div>
        )}
        {!loading && !error && recommendations.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
              <span><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[var(--color-success)]" />候选 {bundle?.total_recommendations || 0}</span>
              <span>高需求 {bundle?.high_demand_count || 0}</span>
              <span>高利润 {bundle?.high_profit_count || 0}</span>
            </div>
            <div className="space-y-2">
              {recommendations.slice(0, 6).map((item) => (
                <RecommendationCard key={item.work_item_id} item={item} onDecide={openDecision} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
