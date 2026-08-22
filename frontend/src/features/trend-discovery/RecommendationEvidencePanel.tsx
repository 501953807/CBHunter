import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, PackageSearch, TriangleAlert } from 'lucide-react'
import { getRecommendations } from '../../api/recommender'
import { Card, CardContent } from '../../components/ui/Card'
import type { ProductRecommendation, RecommenderBundle } from '../../types/recommender'
import { logger } from '../../utils/logger'
import { CandidatePoolTable, RecommendationSummaryStrip } from './RecommendationEvidencePanelParts'
import type { DictShape } from './TrendDiscoveryTypes'

export function RecommendationEvidencePanel({ dict }: { dict: DictShape }) {
  const navigate = useNavigate()
  const platforms = dict?.platforms || []
  const markets = dict?.markets || []
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [bundle, setBundle] = useState<RecommenderBundle | null>(null)
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('')
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
      logger.error('推荐候选商品加载失败', e)
      if (!cancelled) setError(e?.response?.data?.detail || e?.message || '加载失败')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [market, platform])

  const recommendations = bundle?.recommendations || []

  useEffect(() => {
    if (recommendations.length === 0) {
      setSelectedRecommendationId('')
      return
    }
    if (!recommendations.some((item) => item.work_item_id === selectedRecommendationId)) {
      setSelectedRecommendationId(recommendations[0].work_item_id)
    }
  }, [recommendations, selectedRecommendationId])

  const openDecision = (item: ProductRecommendation) => {
    navigate(`/product-selection?candidate_id=${encodeURIComponent(item.work_item_id)}&platform=${encodeURIComponent(item.target_platform || platform)}&market=${encodeURIComponent(item.target_market || market)}`)
  }

  return (
    <Card className="trend-recommendation-panel">
      <CardContent className="space-y-3 pt-4">
        <div className="trend-recommendation-toolbar flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">推荐候选商品</h3>
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
          >
            <option value="">选择平台</option>
            {platforms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
          >
            <option value="">选择市场</option>
            {markets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Database className="h-4 w-4 animate-pulse" /> 正在读取真实来源并生成候选推荐...
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
            <span>{bundle.note || '真实来源不足，暂不能生成推荐。'}</span>
          </div>
        )}
        {!loading && !error && recommendations.length > 0 && (
          <>
            <RecommendationSummaryStrip
              total={bundle?.total_recommendations || 0}
              highDemand={bundle?.high_demand_count || 0}
              highProfit={bundle?.high_profit_count || 0}
            />
            <CandidatePoolTable
              items={recommendations.slice(0, 12)}
              selectedRecommendationId={selectedRecommendationId || recommendations[0].work_item_id}
              onSelect={setSelectedRecommendationId}
              onDecide={openDecision}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
