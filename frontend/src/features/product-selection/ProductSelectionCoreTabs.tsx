import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Calendar, DollarSign, Eye, Package, Plus, RefreshCw, Store, ThumbsUp, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { DataTable } from '../../components/shared/DataTable'
import { useCompetitors, useAddCompetitor } from '../../hooks/useResearch'
import { decideProduct, getDecisionConfig, type DecisionPolicy, type DecisionScores } from '../../api/scout'
import { getRecommendations } from '../../api/recommender'
import { useConfig } from '../../hooks/useConfig'
import { filterPlatformsByCapability } from '../../utils/platformCapabilities'
import { logger } from '../../utils/logger'
import type { Column } from '../../components/shared/DataTable'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import { DecisionCandidateContext } from './DecisionCandidateContext'
import type { ApiResponse } from '../../types/common'
import type { ProductRecommendation } from '../../types/recommender'

const DIMENSION_ICONS: Record<keyof DecisionScores, React.ComponentType<{ className?: string }>> = {
  weight: Package, competition: Users, margin: TrendingUp, video_show: Eye,
  seasonality: Calendar, supplier_count: Store, repurchase: RefreshCw,
  pain_point: ThumbsUp, price: DollarSign,
}

export function DecisionMatrixTab() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCandidateId = searchParams.get('candidate_id') || ''
  const initialPlatform = searchParams.get('platform') || ''
  const initialMarket = searchParams.get('market') || ''
  const { platforms, markets } = useConfig()
  const [scores, setScores] = useState<Partial<Record<keyof DecisionScores, string>>>({})
  const [policy, setPolicy] = useState<DecisionPolicy | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [platform, setPlatform] = useState(initialPlatform)
  const [market, setMarket] = useState(initialMarket)
  const [candidates, setCandidates] = useState<ProductRecommendation[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [candidateError, setCandidateError] = useState('')

  useEffect(() => {
    getDecisionConfig().then(response => { setPolicy(response.data); setEvidence(response) })
      .catch(error => logger.error('Decision policy load failed', error))
  }, [])
  useEffect(() => {
    if (!platform && platforms[0]?.id) setPlatform(platforms[0].id)
    if (!market && markets[0]?.id) setMarket(markets[0].id)
  }, [market, markets, platform, platforms])
  useEffect(() => {
    if (!platform || !market) return
    let cancelled = false
    setCandidateError('')
    getRecommendations(platform, market).then((response) => {
      if (cancelled) return
      const items = response.data?.recommendations || []
      setCandidates(items)
      if (initialCandidateId && items.some(item => item.work_item_id === initialCandidateId)) {
        setCandidateId(initialCandidateId)
      } else {
        setCandidateId((current) => current && items.some(item => item.work_item_id === current) ? current : items[0]?.work_item_id || '')
      }
    }).catch((error: any) => {
      logger.error('Decision candidate load failed', error)
      if (!cancelled) {
        setCandidates([])
        setCandidateId('')
        setCandidateError(error?.response?.data?.detail || error?.message || '候选商品加载失败')
      }
    })
    return () => { cancelled = true }
  }, [initialCandidateId, market, platform])
  const selectedCandidate = candidates.find(item => item.work_item_id === candidateId) || null
  const completed = Boolean(policy?.dimensions.every(({ key }) => {
    const value = Number(scores[key])
    return scores[key] !== '' && scores[key] != null && value > 0 && value <= 10
  }) && selectedCandidate)

  const handleDecide = async () => {
    setLoading(true)
    setResult(null)
    try {
      const payload = {
        ...(Object.fromEntries(policy!.dimensions.map(({ key }) => [key, Number(scores[key])])) as unknown as DecisionScores),
        work_item_id: selectedCandidate!.work_item_id,
        object_refs: selectedCandidate!.object_refs,
        product_name: selectedCandidate!.product_name,
        target_platform: selectedCandidate!.target_platform,
        target_market: selectedCandidate!.target_market,
      }
      const response = await decideProduct(payload)
      setResult(response.data)
      setEvidence(response)
    } catch (error) {
      logger.error('Product decision failed', error)
    }
    setLoading(false)
  }

  const getScoreLevel = (rawScore?: string) => {
    if (!rawScore || !policy) return { text: 'text-[var(--color-muted)]', label: '待评分' }
    const score = Number(rawScore)
    if (score >= policy.green_threshold) return { text: 'text-[var(--color-success)]', label: '绿灯' }
    if (score >= policy.yellow_threshold) return { text: 'text-[var(--color-warning)]', label: '黄灯' }
    return { text: 'text-[var(--color-danger)]', label: '红灯' }
  }

  return (
    <div className="space-y-4">
      <DecisionCandidateContext
        platform={platform}
        platforms={platforms}
        market={market}
        markets={markets}
        candidateError={candidateError}
        candidates={candidates}
        candidateId={candidateId}
        selectedCandidate={selectedCandidate}
        onPlatformChange={setPlatform}
        onMarketChange={setMarket}
        onCandidateChange={(value) => { setCandidateId(value); setScores({}); setResult(null) }}
      />
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold text-[var(--color-fg)] mb-4">九维决策评分</h3>
          <EvidenceBanner evidence={evidence} compact />
          <div className="space-y-4">
            {(policy?.dimensions || []).map((dimension) => {
              const level = getScoreLevel(scores[dimension.key])
              const DimensionIcon = DIMENSION_ICONS[dimension.key]
              return (
                <div key={dimension.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <DimensionIcon className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                    <span className="text-sm font-medium text-[var(--color-fg)]">{dimension.label}</span>
                    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${level.text} bg-[var(--color-bg)]`}>
                      {scores[dimension.key] ? `${scores[dimension.key]}分` : '--'} {level.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" max="10" step="1" placeholder="1-10"
                      className="w-24 text-xs border rounded px-2 py-1.5"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
                      value={scores[dimension.key] || ''}
                      onChange={(event) => setScores({ ...scores, [dimension.key]: event.target.value })} />
                    <span className="text-[11px] text-[var(--color-muted)] flex-1">{dimension.help}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={handleDecide} disabled={loading || !completed}
            className="mt-4 w-full py-2.5 bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm font-medium rounded-xl hover:bg-[var(--color-primary-hover)] disabled:opacity-40 transition-colors">
            {loading ? '评估中...' : completed ? '执行决策评估' : '请先完成全部维度评分'}
          </button>
        </CardContent>
      </Card>

      {result && (
        <Card className={`border-2 ${result.decision === 'green_light' ? 'border-[var(--color-success)]' : result.decision === 'yellow_light' ? 'border-[var(--color-warning)]' : 'border-[var(--color-danger)]'}`}>
          <CardContent className="pt-4">
            <h3 className="text-lg font-bold text-[var(--color-fg)]">{result.decision_label}</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              平均 {result.average_score} 分 · 绿灯 {result.green_count}/9 项 · 黄灯 {result.yellow_count}/9 项 · 红灯 {result.red_count}/9 项
            </p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {result.score_breakdown?.map((breakdown: any) => (
                <div key={breakdown.dimension} className="text-center p-2 rounded-lg border text-xs"
                  style={{
                    borderColor: breakdown.level === 'green' ? 'var(--color-success)' : breakdown.level === 'yellow' ? 'var(--color-warning)' : 'var(--color-danger)',
                    backgroundColor: breakdown.level === 'green' ? 'var(--color-success-light)' : breakdown.level === 'yellow' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                  }}>
                  <p className="font-medium">{breakdown.dimension}</p>
                  <p className="text-lg font-bold">{breakdown.score}</p>
                  <p>{breakdown.level === 'green' ? '绿灯' : breakdown.level === 'yellow' ? '黄灯' : '红灯'}</p>
                </div>
              ))}
            </div>
            <div className="bg-[var(--color-primary-light)] rounded-xl p-3 text-sm text-[var(--color-primary)]">
              <p className="font-medium mb-1">建议行动</p>
              <p>{result.action}</p>
            </div>
            {result.content_queue_item && (
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
                <p className="font-medium text-[var(--color-fg)]">已进入内容制作队列</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{result.content_queue_item.product_name}</p>
                <button onClick={() => navigate(result.content_queue_item.route || '/content')} className="mt-2 rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
                  进入内容工厂
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function CompetitorsTab() {
  const { platforms } = useConfig()
  const { data, isLoading } = useCompetitors()
  const addMutation = useAddCompetitor()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ platform: '', name: '', seller_name: '', price: 0 })
  const competitorPlatforms = filterPlatformsByCapability(platforms, 'competitor')

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'name', header: '商品名称', render: (row) => <span className="font-medium">{row.name as string}</span> },
    { key: 'seller_name', header: '卖家', render: (row) => (row.seller_name as string) || '--' },
    { key: 'platform', header: '平台', width: '80px' },
    { key: 'price', header: '价格', render: (row) => row.price ? `¥${(row.price as number).toFixed(2)}` : '--' },
    { key: 'rating', header: '评分', render: (row) => row.rating ? `${row.rating}/5` : '--' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-3.5 h-3.5 mr-1" />添加竞品</Button>
      </div>
      {showAdd && (
        <Card><CardContent className="pt-4"><div className="grid grid-cols-4 gap-3">
          <Select options={competitorPlatforms.map((platform) => ({ value: platform.id, label: platform.label }))}
            value={form.platform} onChange={(value) => setForm({ ...form, platform: value })} />
          <Input placeholder="商品名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input placeholder="卖家名称" value={form.seller_name} onChange={(event) => setForm({ ...form, seller_name: event.target.value })} />
          <Button disabled={!form.platform || !form.name.trim()} onClick={() => {
            addMutation.mutate({ platform: form.platform, name: form.name, seller_name: form.seller_name || undefined, price: form.price || undefined })
            setForm({ platform: '', name: '', seller_name: '', price: 0 })
          }}>添加</Button>
        </div></CardContent></Card>
      )}
      <Card><CardContent className="pt-4"><DataTable
        columns={columns}
        data={(data?.data ?? []) as unknown as Record<string, unknown>[]}
        keyField="id"
        loading={isLoading}
        emptyMessage="暂无竞品数据，点击「添加竞品」开始追踪"
      /></CardContent></Card>
    </div>
  )
}
