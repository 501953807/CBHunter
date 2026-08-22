import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, ClipboardList, DollarSign, Eye, Package, RefreshCw, Search, Store, ThumbsUp, TrendingUp, Users, XCircle } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EvidenceBanner } from '../../components/shared/EvidenceBanner'
import type { ApiResponse } from '../../types/common'
import type { ProductRecommendation } from '../../types/recommender'
import type { DecisionPolicy, DecisionScores } from '../../api/scout'

export type EvidenceSummary = { total: number; present: number; missing: number; stale: number; low_confidence: number }
export type SelectionOption = { id: string; label: string }

export const EVIDENCE_LABELS: Record<string, string> = {
  trend: '趋势',
  social: '社媒',
  platform: '平台',
  supply: '供应',
  profit: '利润',
  competitor: '竞品',
  content: '内容',
  risk: '风险',
}

export const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  present: '已具备',
  missing: '待补',
  stale: '需刷新',
  low_confidence: '低置信',
}

const DIMENSION_ICONS: Record<keyof DecisionScores, React.ComponentType<{ className?: string }>> = {
  weight: Package,
  competition: Users,
  margin: TrendingUp,
  video_show: Eye,
  seasonality: Calendar,
  supplier_count: Store,
  repurchase: RefreshCw,
  pain_point: ThumbsUp,
  price: DollarSign,
}

export function CandidateDecisionPoolPanel({
  platform,
  market,
  platforms,
  markets,
  candidateError,
  candidates,
  candidateId,
  onPlatformChange,
  onMarketChange,
  onSelectCandidate,
}: {
  platform: string
  market: string
  platforms: SelectionOption[]
  markets: SelectionOption[]
  candidateError: string
  candidates: ProductRecommendation[]
  candidateId: string
  onPlatformChange: (value: string) => void
  onMarketChange: (value: string) => void
  onSelectCandidate: (value: string) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4" aria-label="决策商品池">
        <div>
          <p className="text-xs font-semibold text-[var(--color-primary)]">候选商品决策工作台</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-fg)]">决策商品池</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">从候选验证带入真实商品，先选对象，再看资料、评分和下游动作。</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={platform} onChange={(event) => onPlatformChange(event.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-xs text-[var(--color-fg)]">
            <option value="">选择平台</option>
            {platforms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={market} onChange={(event) => onMarketChange(event.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-xs text-[var(--color-fg)]">
            <option value="">选择市场</option>
            {markets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        {candidateError && <p className="rounded-lg bg-[var(--color-danger-light)] px-3 py-2 text-xs text-[var(--color-danger)]">{candidateError}</p>}
        {!candidateError && candidates.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-8 text-center text-xs text-[var(--color-muted)]">
            暂无可决策候选。请先回到候选验证补充趋势、平台、供应或竞品资料。
          </div>
        )}
        <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {candidates.map((item) => {
            const summary = normalizeEvidenceSummary(item.evidence_summary)
            const active = item.work_item_id === candidateId
            return (
              <button key={item.work_item_id} type="button" onClick={() => onSelectCandidate(item.work_item_id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-[var(--shadow-sm)]' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{item.target_platform} / {item.target_market}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-primary)]">{item.score}分</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                  <span className="rounded-lg bg-[var(--color-surface)] px-1.5 py-1 text-[var(--color-muted)]">资料 {summary.present}/{summary.total}</span>
                  <span className="rounded-lg bg-[var(--color-surface)] px-1.5 py-1 text-[var(--color-muted)]">{item.demand_level || '需求待判'}</span>
                  <span className="rounded-lg bg-[var(--color-surface)] px-1.5 py-1 text-[var(--color-muted)]">{item.profit_potential || '利润待算'}</span>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function CandidateDecisionAnalysisPanel({
  policy,
  selectedCandidate,
  selectedEvidence,
  scores,
  evidence,
  result,
  loading,
  completed,
  scoredCount,
  averageDraftScore,
  getScoreLevel,
  onScoreChange,
  onDecide,
  onSupplement,
}: {
  policy: DecisionPolicy | null
  selectedCandidate: ProductRecommendation | null
  selectedEvidence: EvidenceSummary
  scores: Partial<Record<keyof DecisionScores, string>>
  evidence: ApiResponse | null
  result: any
  loading: boolean
  completed: boolean
  scoredCount: number
  averageDraftScore: number
  getScoreLevel: (rawScore?: string) => { text: string; label: string }
  onScoreChange: (key: keyof DecisionScores, value: string) => void
  onDecide: () => void
  onSupplement: () => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-4" aria-label="决策分析面板">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">围绕一个候选商品决策</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{selectedCandidate?.product_name || '请选择候选商品'}</h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {selectedCandidate ? `${selectedCandidate.work_item_id} · ${selectedCandidate.lifecycle_label || '待归类'}` : '评分、关键词、竞品、利润和平台适配都应绑定同一个商品对象。'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <MetricPill label="资料完整度" value={`${selectedEvidence.present}/${selectedEvidence.total}`} />
            <MetricPill label="已评分" value={`${scoredCount}/9`} />
            <MetricPill label="当前均分" value={averageDraftScore ? `${averageDraftScore}` : '--'} />
          </div>
        </div>

        <EvidenceBanner evidence={evidence} compact />

        {selectedCandidate ? (
          <>
            <div className="grid gap-3 lg:grid-cols-3">
              <DecisionInfoCard title="关键词与需求" icon={Search}
                lines={[`关键词：${formatList(selectedCandidate.keywords)}`, `搜索量：${selectedCandidate.search_volume ?? '待接入'}`, `趋势：${selectedCandidate.trend_direction || '待判断'}${selectedCandidate.seasonal ? ' · 季节性' : ''}`]} />
              <DecisionInfoCard title="竞品与市场" icon={Users}
                lines={[`竞争度：${selectedCandidate.competition_level || '待补'}`, `均价：${selectedCandidate.avg_price_local == null ? '待同步' : selectedCandidate.avg_price_local}`, `资料状态：${EVIDENCE_STATUS_LABELS[selectedCandidate.evidence_completeness?.competitor] || '待补'}`]} />
              <DecisionInfoCard title="利润与供应" icon={DollarSign}
                lines={[`建议采购：${selectedCandidate.suggested_sourcing_price_rmb || '待询价'}`, `建议售价：${selectedCandidate.suggested_selling_price_local ?? '待测算'}`, `利润潜力：${selectedCandidate.profit_potential || '待测算'}`]} />
            </div>

            <DecisionScoreGrid
              policy={policy}
              scores={scores}
              getScoreLevel={getScoreLevel}
              onScoreChange={onScoreChange}
              onDecide={onDecide}
              onSupplement={onSupplement}
              loading={loading}
              completed={completed}
            />

            <DecisionResultPanel result={result} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-16 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-[var(--color-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-fg)]">先选择一个候选商品</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">系统不会在没有商品对象的情况下做关键词、竞品或利润判断。</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DecisionScoreGrid({
  policy,
  scores,
  getScoreLevel,
  onScoreChange,
  onDecide,
  onSupplement,
  loading,
  completed,
}: {
  policy: DecisionPolicy | null
  scores: Partial<Record<keyof DecisionScores, string>>
  getScoreLevel: (rawScore?: string) => { text: string; label: string }
  onScoreChange: (key: keyof DecisionScores, value: string) => void
  onDecide: () => void
  onSupplement: () => void
  loading: boolean
  completed: boolean
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-[var(--color-fg)]">九维决策评分</h3>
          <p className="text-xs text-[var(--color-muted)]">评分只服务当前候选商品；绿灯进入内容工厂，黄灯观察或补资料，红灯淘汰。</p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">
          绿灯阈值 {policy?.green_threshold ?? '--'} · 黄灯阈值 {policy?.yellow_threshold ?? '--'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(policy?.dimensions || []).map((dimension) => {
          const level = getScoreLevel(scores[dimension.key])
          const DimensionIcon = DIMENSION_ICONS[dimension.key]
          return (
            <label key={dimension.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <div className="flex items-center gap-2">
                <DimensionIcon className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                <span className="text-sm font-medium text-[var(--color-fg)]">{dimension.label}</span>
                <span className={`ml-auto rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] font-medium ${level.text}`}>
                  {scores[dimension.key] ? `${scores[dimension.key]}分` : '--'} {level.label}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input type="number" min="1" max="10" step="1" placeholder="1-10"
                  className="w-20 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg)]"
                  value={scores[dimension.key] || ''}
                  onChange={(event) => onScoreChange(dimension.key, event.target.value)} />
                <span className="flex-1 text-[11px] text-[var(--color-muted)]">{dimension.help}</span>
              </div>
            </label>
          )
        })}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        <Button onClick={onDecide} disabled={loading || !completed} className="md:col-span-2">
          {loading ? '评估中...' : completed ? '执行决策评估' : '请先完成九维评分'}
        </Button>
        <Button variant="outline" onClick={onSupplement}><AlertTriangle className="mr-1 h-4 w-4" />补资料</Button>
        <Button variant="outline"><Eye className="mr-1 h-4 w-4" />观察</Button>
      </div>
    </div>
  )
}

function DecisionResultPanel({ result }: { result: any }) {
  if (!result) return null
  return (
    <div className={`rounded-2xl border-2 p-4 ${result.decision === 'green_light' ? 'border-[var(--color-success)] bg-[var(--color-success-light)]' : result.decision === 'yellow_light' ? 'border-[var(--color-warning)] bg-[var(--color-warning-light)]' : 'border-[var(--color-danger)] bg-[var(--color-danger-light)]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-fg)]">{result.decision_label}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            平均 {result.average_score} 分 · 绿灯 {result.green_count}/9 项 · 黄灯 {result.yellow_count}/9 项 · 红灯 {result.red_count}/9 项
          </p>
        </div>
        <Button variant={result.decision === 'red_light' ? 'danger' : 'outline'} size="sm" disabled={result.decision !== 'red_light'}>
          <XCircle className="mr-1 h-4 w-4" />淘汰
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {result.score_breakdown?.map((breakdown: any) => (
          <div key={breakdown.dimension} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-center text-xs">
            <p className="font-medium text-[var(--color-fg)]">{breakdown.dimension}</p>
            <p className="text-lg font-bold text-[var(--color-fg)]">{breakdown.score}</p>
            <p className="text-[var(--color-muted)]">{breakdown.level === 'green' ? '绿灯' : breakdown.level === 'yellow' ? '黄灯' : '红灯'}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[var(--color-surface)] p-3 text-sm text-[var(--color-fg)]">
        <p className="font-medium">建议行动</p>
        <p className="mt-1 text-[var(--color-muted)]">{result.action}</p>
      </div>
    </div>
  )
}

export function CandidateDecisionDownstreamPanel({
  selectedCandidate,
  result,
  onOpenContent,
}: {
  selectedCandidate: ProductRecommendation | null
  result: any
  onOpenContent: (route: string) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <p className="text-xs font-semibold text-[var(--color-primary)]">平台适配</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-fg)]">下游动作与字段准备</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">只展示当前商品进入 Listing 制作前必须关注的字段、素材和平台差异。</p>
        </div>
        {selectedCandidate ? (
          <>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--color-fg)]">{selectedCandidate.target_platform} · {selectedCandidate.target_market}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(selectedCandidate.evidence_completeness || {}).map(([key, value]) => (
                  <span key={key} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                    {EVIDENCE_LABELS[key] || key}：{EVIDENCE_STATUS_LABELS[value] || value}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Listing 制作提示</h3>
              {safeTextList(selectedCandidate.listing_tips).map((tip, index) => (
                <p key={`${tip}-${index}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">{tip}</p>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">经验与缺口</h3>
              {(selectedCandidate.experience_notes || []).slice(0, 3).map((note) => (
                <div key={`${note.type}-${note.title}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <p className="text-xs font-medium text-[var(--color-fg)]">{note.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">{note.content}</p>
                </div>
              ))}
              {(selectedCandidate.data_gaps || []).map((gap) => (
                <p key={gap} className="rounded-lg bg-[var(--color-warning-light)] px-3 py-2 text-xs text-[var(--color-warning)]">待补：{gap}</p>
              ))}
            </div>
            <div className="grid gap-2">
              <Button disabled={!result?.content_queue_item} onClick={() => onOpenContent(result?.content_queue_item?.route || '/content')}>
                <CheckCircle2 className="mr-1 h-4 w-4" />进入内容工厂
              </Button>
              <Button variant="outline" onClick={() => onOpenContent('/content')} disabled={!result}>
                查看内容队列<ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-8 text-center text-xs text-[var(--color-muted)]">
            选择候选商品后显示平台字段、素材要求和内容工厂衔接。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="font-semibold text-[var(--color-fg)]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{label}</p>
    </div>
  )
}

function DecisionInfoCard({ title, icon: Icon, lines }: { title: string; icon: React.ComponentType<{ className?: string }>; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{title}</h3>
      </div>
      <div className="mt-2 space-y-1">
        {lines.map((line) => <p key={line} className="text-xs text-[var(--color-muted)]">{line}</p>)}
      </div>
    </div>
  )
}

export function normalizeEvidenceSummary(value: unknown): EvidenceSummary {
  const summary = value && typeof value === 'object' ? value as Partial<Record<keyof EvidenceSummary, unknown>> : {}
  return {
    total: toCount(summary.total),
    present: toCount(summary.present),
    missing: toCount(summary.missing),
    stale: toCount(summary.stale),
    low_confidence: toCount(summary.low_confidence),
  }
}

function toCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
}

function safeTextList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : ['待补充 Listing 要点']
}

function formatList(value: unknown): string {
  const items = safeTextList(value)
  return items.length ? items.slice(0, 4).join('、') : '待补'
}
