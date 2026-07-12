import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import { getRecommenderReadiness } from '../../api/recommender'
import { Card, CardContent } from '../../components/ui/Card'
import type { RecommenderReadiness } from '../../types/recommender'
import { logger } from '../../utils/logger'
import type { DictShape } from './TrendDiscoveryTypes'

const COUNT_LABELS: Record<string, string> = {
  candidate_products: '候选商品',
  trend_signals: '趋势证据',
  competitor_products: '竞品证据',
  supply_products: '1688 供应商品',
  historical_outcomes: '历史经营结果',
}

export function RecommenderReadinessPanel({ dict }: { dict: DictShape }) {
  const platforms = dict?.platforms || []
  const markets = dict?.markets || []
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [readiness, setReadiness] = useState<RecommenderReadiness | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!platform || !market) return
    let cancelled = false
    setError('')
    getRecommenderReadiness(platform, market).then((response) => {
      if (!cancelled) setReadiness(response.data || null)
    }).catch((e: any) => {
      logger.error('选品决策就绪度加载失败', e)
      if (!cancelled) setError(e?.response?.data?.detail || e?.message || '加载失败')
    })
    return () => { cancelled = true }
  }, [market, platform])

  const statusItem = (label: string, ready: boolean) => (
    <div className="flex items-center gap-2 text-xs">
      {ready
        ? <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
        : <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />}
      <span className="text-[var(--color-fg)]">{label}</span>
      <span className="text-[var(--color-muted)]">{ready ? '可用' : '待补数据'}</span>
    </div>
  )

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto">
            <Database className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">自动选品决策就绪度</h3>
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-fg)]">
            <option value="">选择平台</option>
            {platforms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={market} onChange={(e) => setMarket(e.target.value)}
            className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-fg)]">
            <option value="">选择市场</option>
            {markets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>

        {!platform || !market ? <p className="text-xs text-[var(--color-muted)]">请选择平台和市场后检查真实证据就绪度。</p> : null}
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        {readiness && (
          <>
            <div className="flex flex-wrap gap-4">
              {statusItem('真实证据规则决策', readiness.rules_decision_status === 'ready')}
              {statusItem('历史数据模型训练', readiness.model_training_status === 'ready')}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(readiness.counts).map(([key, value]) => (
                <div key={key} className="border border-[var(--color-border)] rounded-md px-2 py-2">
                  <p className="text-[11px] text-[var(--color-muted)]">{COUNT_LABELS[key] || key}</p>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">
                    {value}<span className="text-[11px] font-normal text-[var(--color-muted)]"> / {readiness.minimums[key]}</span>
                  </p>
                </div>
              ))}
            </div>
            {readiness.required_actions.length > 0 && (
              <div className="text-xs text-[var(--color-muted)]">
                <p className="font-medium text-[var(--color-fg)] mb-1">待补数据</p>
                {readiness.required_actions.map((action) => <p key={action}>· {action}</p>)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
