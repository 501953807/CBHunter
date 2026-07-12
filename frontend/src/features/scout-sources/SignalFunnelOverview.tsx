import { useEffect, useState } from 'react'
import { ArrowRight, CircleDashed, Database, Layers3, RefreshCw } from 'lucide-react'
import { getScoutFunnel } from '../../api/scout'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { logger } from '../../utils/logger'

const EVIDENCE_LABELS: Record<string, string> = {
  present: '已具备',
  missing: '待补',
}

export function SignalFunnelOverview() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getScoutFunnel()
      setData(res.data || null)
      setError('')
    } catch (e: any) {
      logger.error('Load scout funnel failed', e)
      setError('信号漏斗加载失败，请确认后端服务正常')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const layers = data?.layers || []
  const candidates = data?.candidates || []
  const stream = data?.signal_stream || []
  const metrics = data?.metrics || { signal_count: 0, candidate_count: 0, complete_candidate_count: 0 }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">四层信号漏斗</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              从社交文娱与趋势信号收缩到平台商品和供应渠道，候选卡只来自真实记录归并。
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {error && <p className="rounded-lg bg-[var(--color-danger-light)] px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}

        <div className="grid gap-2 md:grid-cols-3">
          <Metric label="信号记录" value={metrics.signal_count} />
          <Metric label="归并候选" value={metrics.candidate_count} />
          <Metric label="证据完整候选" value={metrics.complete_candidate_count} />
        </div>

        <div className="grid gap-2 lg:grid-cols-4">
          {layers.map((layer: any) => (
            <div key={layer.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-fg)]">{layer.label}</span>
                <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] text-[var(--color-primary)]">
                  {layer.signal_count} 条
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">覆盖 {layer.candidate_count} 个候选</p>
              <div className="mt-2 space-y-1">
                {(layer.latest_signals || []).slice(0, 2).map((item: any) => (
                  <p key={`${item.source_type}-${item.source_id}`} className="truncate text-[11px] text-[var(--color-muted)]">
                    {item.title} · {item.source_name}
                  </p>
                ))}
                {(layer.latest_signals || []).length === 0 && <p className="text-[11px] text-[var(--color-warning)]">待补该层真实证据</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
          <CandidateCards candidates={candidates} />
          <SignalStream stream={stream} />
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function CandidateCards({ candidates }: { candidates: any[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)]">
        <Database className="h-3.5 w-3.5 text-[var(--color-primary)]" />
        归并候选商品
      </div>
      {candidates.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
          暂无可归并候选。请先在四层渠道中录入真实来源、链接或手工凭证。
        </div>
      )}
      {candidates.slice(0, 5).map((candidate: any) => (
        <div key={candidate.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">{candidate.title}</h3>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                证据 {candidate.evidence_summary.present}/{candidate.evidence_summary.total}
                {candidate.missing_layers.length > 0 ? ` · 缺 ${candidate.missing_layers.join('、')}` : ' · 可进入选品决策'}
              </p>
            </div>
            <a href={candidate.next_action_route} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-primary)] hover:border-[var(--color-primary)]">
              {candidate.next_action}<ArrowRight className="h-3 w-3" />
            </a>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 md:grid-cols-4">
            {Object.entries(candidate.layer_evidence).map(([layer, status]) => (
              <span key={layer} className={`rounded px-2 py-1 text-[11px] ${status === 'present' ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'}`}>
                {layerName(layer)}：{EVIDENCE_LABELS[String(status)] || String(status)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SignalStream({ stream }: { stream: any[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)]">
        <CircleDashed className="h-3.5 w-3.5 text-[var(--color-primary)]" />
        最新信号流
      </div>
      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {stream.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
            当前没有信号流记录。
          </div>
        )}
        {stream.slice(0, 10).map((item: any) => (
          <div key={`${item.source_type}-${item.source_id}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-[var(--color-fg)]">{item.title}</span>
              <span className="shrink-0 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">{item.layer_label}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">{item.source_name} · {item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function layerName(layer: string) {
  const names: Record<string, string> = {
    culture: '社交',
    trend: '趋势',
    platform: '平台',
    supply: '供应',
  }
  return names[layer] || layer
}
