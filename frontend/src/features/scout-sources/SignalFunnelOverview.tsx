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
  const [visibleStreamCount, setVisibleStreamCount] = useState(10)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getScoutFunnel()
      setData(res.data || null)
      setVisibleStreamCount(10)
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
          <Metric label="四层完整候选" value={metrics.complete_candidate_count} />
        </div>

        <SignalFunnelMap layers={layers} metrics={metrics} />
        <CompleteCandidateRepairPanel metrics={metrics} />

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
                {(layer.latest_signals || []).length === 0 && <p className="text-[11px] text-[var(--color-warning)]">待补该层真实来源</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
          <CandidateCards candidates={candidates} />
          <SignalStream stream={stream} visibleCount={visibleStreamCount} onLoadMore={() => setVisibleStreamCount(count => count + 10)} />
        </div>
      </CardContent>
    </Card>
  )
}

function SignalFunnelMap({ layers, metrics }: { layers: any[]; metrics: any }) {
  const orderedLayers = orderLayers(layers)
  const signalCount = Number(metrics.signal_count || 0)
  const candidateCount = Number(metrics.candidate_count || 0)
  const completeCount = Number(metrics.complete_candidate_count || 0)
  const conversionPct = signalCount > 0 ? Math.round((candidateCount / signalCount) * 100) : 0
  const completePct = candidateCount > 0 ? Math.round((completeCount / candidateCount) * 100) : 0
  const maxSignals = Math.max(...orderedLayers.map(layer => Number(layer.signal_count || 0)), 1)

  return (
    <section className="signal-funnel-map" aria-label="四层信号收缩路径">
      <div className="signal-funnel-map-header">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-primary)]">信号收缩路径</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">从市场信号到候选商品</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">先看四层来源是否有真实记录，再看这些记录能否归并成可决策商品。</p>
        </div>
        <div className="signal-funnel-scorecard">
          <span>归并率</span>
          <strong>{conversionPct}%</strong>
          <small>完整候选 {completePct}%</small>
        </div>
      </div>

      <div className="signal-funnel-path" role="list" aria-label="四层来源节点">
        {orderedLayers.map((layer, index) => {
          const signalValue = Number(layer.signal_count || 0)
          const candidateValue = Number(layer.candidate_count || 0)
          const width = Math.max(8, Math.round((signalValue / maxSignals) * 100))
          const ready = signalValue > 0
          return (
            <div key={layer.id || index} className="signal-funnel-node" role="listitem" data-ready={ready ? 'true' : 'false'}>
              <div className="flex items-center justify-between gap-2">
                <span className="signal-funnel-step">{index + 1}</span>
                <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                  {ready ? '已接入' : '待补数'}
                </span>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-[var(--color-fg)]">{layer.label || layerName(layer.id)}</h4>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{signalValue} 条信号 · 覆盖 {candidateValue} 个候选</p>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--color-bg)]">
                <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${width}%` }} />
              </div>
              {index < orderedLayers.length - 1 && <ArrowRight className="signal-funnel-arrow" aria-hidden="true" />}
            </div>
          )
        })}
      </div>

      <div className="signal-funnel-outcome">
        <div>
          <p className="text-[11px] text-[var(--color-muted)]">输入</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">{signalCount} 条真实信号</p>
        </div>
        <div className="signal-funnel-outcome-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(4, Math.min(100, conversionPct))}%` }} />
        </div>
        <div className="text-right">
          <p className="text-[11px] text-[var(--color-muted)]">输出</p>
          <p className="text-sm font-semibold text-[var(--color-fg)]">{candidateCount} 个候选 · {completeCount} 个完整</p>
        </div>
      </div>
    </section>
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

function CompleteCandidateRepairPanel({ metrics }: { metrics: any }) {
  const candidateCount = Number(metrics?.candidate_count || 0)
  const completeCount = Number(metrics?.complete_candidate_count || 0)
  if (candidateCount === 0 || completeCount > 0) return null
  const repairs = [
    { layer: 'culture', title: '补社交文娱影响', detail: '录入小红书、Facebook、TikTok Creative Center 等可追溯链接、截图或评论资料。' },
    { layer: 'trend', title: '补流行趋势', detail: '同步或手工录入 Pinterest / Google Trends 关键词，标记市场、时间窗口和趋势方向。' },
    { layer: 'platform', title: '补销售平台', detail: '补 Shopee、TEMU、TikTok Shop 热卖商品链接、价格带、销量或评分资料。' },
    { layer: 'supply', title: '补供应渠道', detail: '补 1688/供应商链接、采购价、起订量、规格、图片和发货周期。' },
  ]
  return (
    <section className="rounded-2xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-4" aria-label="完整候选补齐路径">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--color-warning)]">完整候选补齐路径</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--color-fg)]">已有候选，但四层资料还没有形成闭环</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">系统不会把不完整候选冒充为可决策商品；请按缺失层补真实来源后再进入选品决策。</p>
        </div>
        <span className="rounded-full bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-warning)]">
          {completeCount}/{candidateCount} 个完整候选
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {repairs.map(item => (
          <a key={item.layer} href={`#scout-layer-${item.layer}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs hover:border-[var(--color-warning)]">
            <p className="font-semibold text-[var(--color-fg)]">{item.title}</p>
            <p className="mt-1 leading-5 text-[var(--color-muted)]">{item.detail}</p>
          </a>
        ))}
      </div>
    </section>
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
                资料 {candidate.evidence_summary.present}/{candidate.evidence_summary.total}
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

function SignalStream({ stream, visibleCount, onLoadMore }: { stream: any[]; visibleCount: number; onLoadMore: () => void }) {
  const visible = stream.slice(0, visibleCount)
  const hasMore = visibleCount < stream.length
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-fg)]">
        <CircleDashed className="h-3.5 w-3.5 text-[var(--color-primary)]" />
        最新信号流
      </div>
      <div className="max-h-80 space-y-2 overflow-auto pr-1" aria-label="最新信号流分页">
        {stream.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
            当前没有信号流记录。
          </div>
        )}
        {visible.map((item: any) => (
          <div key={`${item.source_type}-${item.source_id}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-[var(--color-fg)]">{item.title}</span>
              <span className="shrink-0 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">{item.layer_label}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">{item.source_name} · {item.detail}</p>
          </div>
        ))}
        {hasMore && (
          <button type="button" onClick={onLoadMore} className="w-full rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary)] hover:border-[var(--color-primary)]">
            加载更多信号（已显示 {visible.length}/{stream.length}）
          </button>
        )}
      </div>
    </div>
  )
}

function orderLayers(layers: any[]) {
  const order = ['culture', 'trend', 'platform', 'supply']
  const byId = new Map(layers.map(layer => [layer.id, layer]))
  const ordered = order.map(id => byId.get(id) || { id, label: layerName(id), signal_count: 0, candidate_count: 0, latest_signals: [] })
  const extras = layers.filter(layer => !order.includes(layer.id))
  return [...ordered, ...extras]
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
