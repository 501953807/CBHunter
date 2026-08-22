import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
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
import type { ApiResponse } from '../../types/common'
import type { ProductRecommendation } from '../../types/recommender'
import {
  CandidateDecisionAnalysisPanel,
  CandidateDecisionDownstreamPanel,
  CandidateDecisionPoolPanel,
  normalizeEvidenceSummary,
} from './ProductSelectionDecisionParts'

export function CandidateDecisionWorkbench() {
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
  const selectedEvidence = normalizeEvidenceSummary(selectedCandidate?.evidence_summary)
  const selectedScores = policy?.dimensions.map((dimension) => Number(scores[dimension.key]) || 0) || []
  const scoredCount = selectedScores.filter((score) => score > 0).length
  const averageDraftScore = scoredCount
    ? Number((selectedScores.reduce((sum, score) => sum + score, 0) / scoredCount).toFixed(1))
    : 0
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

  const handleSelectCandidate = (value: string) => {
    setCandidateId(value)
    setScores({})
    setResult(null)
  }

  const getScoreLevel = (rawScore?: string) => {
    if (!rawScore || !policy) return { text: 'text-[var(--color-muted)]', label: '待评分' }
    const score = Number(rawScore)
    if (score >= policy.green_threshold) return { text: 'text-[var(--color-success)]', label: '绿灯' }
    if (score >= policy.yellow_threshold) return { text: 'text-[var(--color-warning)]', label: '黄灯' }
    return { text: 'text-[var(--color-danger)]', label: '红灯' }
  }

  return (
    <div className="space-y-4" data-ui-scheme="selection-decision-workbench">
      <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(280px,320px)_minmax(520px,1fr)_minmax(280px,320px)]" aria-label="候选商品决策工作台">
        <CandidateDecisionPoolPanel
          platform={platform}
          market={market}
          platforms={platforms}
          markets={markets}
          candidateError={candidateError}
          candidates={candidates}
          candidateId={candidateId}
          onPlatformChange={setPlatform}
          onMarketChange={setMarket}
          onSelectCandidate={handleSelectCandidate}
        />

        <CandidateDecisionAnalysisPanel
          policy={policy}
          selectedCandidate={selectedCandidate}
          selectedEvidence={selectedEvidence}
          scores={scores}
          evidence={evidence}
          result={result}
          loading={loading}
          completed={completed}
          scoredCount={scoredCount}
          averageDraftScore={averageDraftScore}
          getScoreLevel={getScoreLevel}
          onScoreChange={(key, value) => setScores({ ...scores, [key]: value })}
          onDecide={handleDecide}
          onSupplement={() => navigate('/scout')}
        />

        <CandidateDecisionDownstreamPanel
          selectedCandidate={selectedCandidate}
          result={result}
          onOpenContent={(route) => navigate(route)}
        />
      </section>
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
