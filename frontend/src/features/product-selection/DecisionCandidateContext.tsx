import { Card, CardContent } from '../../components/ui/Card'
import type { ProductRecommendation } from '../../types/recommender'

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

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  present: '已具备',
  missing: '缺失',
  stale: '过期',
  low_confidence: '低置信',
}

type Option = { id: string; label: string }
type EvidenceSummary = { total: number; present: number; missing: number; stale: number; low_confidence: number }

type DecisionCandidateContextProps = {
  platform: string
  platforms: Option[]
  market: string
  markets: Option[]
  candidateError: string
  candidates: ProductRecommendation[]
  candidateId: string
  selectedCandidate: ProductRecommendation | null
  onPlatformChange: (value: string) => void
  onMarketChange: (value: string) => void
  onCandidateChange: (value: string) => void
}

export function DecisionCandidateContext({
  platform,
  platforms,
  market,
  markets,
  candidateError,
  candidates,
  candidateId,
  selectedCandidate,
  onPlatformChange,
  onMarketChange,
  onCandidateChange,
}: DecisionCandidateContextProps) {
  const candidateOptions = candidates.map((item) => ({ item, summary: normalizeEvidenceSummary(item.evidence_summary) }))
  const selectedEvidence = selectedCandidate ? normalizeEvidenceSummary(selectedCandidate.evidence_summary) : null
  const selectedCompleteness = selectedCandidate?.evidence_completeness || {}

  return (
    <Card>
      <CardContent className="pt-4 space-y-3" aria-label="选品决策商品上下文">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <h3 className="font-semibold text-[var(--color-fg)]">决策商品上下文</h3>
            <p className="text-xs text-[var(--color-muted)]">先锁定推荐候选商品，再执行九维评分；通过后自动衔接内容工厂。</p>
          </div>
          <select value={platform} onChange={(event) => onPlatformChange(event.target.value)}
            className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-fg)]">
            <option value="">选择平台</option>
            {platforms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={market} onChange={(event) => onMarketChange(event.target.value)}
            className="text-xs border border-[var(--color-border)] rounded-md px-2 py-1.5 bg-[var(--color-surface)] text-[var(--color-fg)]">
            <option value="">选择市场</option>
            {markets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        {candidateError && <p className="text-xs text-[var(--color-danger)]">{candidateError}</p>}
        {candidates.length === 0 && !candidateError && (
          <p className="text-xs text-[var(--color-muted)]">暂无可决策候选。请先在趋势与候选中补充真实趋势、平台、供应或竞品资料。</p>
        )}
        {candidates.length > 0 && (
          <select value={candidateId} onChange={(event) => onCandidateChange(event.target.value)}
            className="w-full text-sm border border-[var(--color-border)] rounded-lg px-3 py-2 bg-[var(--color-surface)] text-[var(--color-fg)]">
            {candidateOptions.map(({ item, summary }) => (
              <option key={item.work_item_id} value={item.work_item_id}>
                {item.product_name} · {item.lifecycle_label || '待归类'} · 资料 {summary.present}/{summary.total}
              </option>
            ))}
          </select>
        )}
        {selectedCandidate && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-fg)]">{selectedCandidate.product_name}</p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  {selectedCandidate.work_item_id} · {selectedCandidate.target_platform} / {selectedCandidate.target_market}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--color-fg)]">{selectedCandidate.score} 分</p>
                <p className="text-[11px] text-[var(--color-muted)]">{selectedCandidate.decision_label}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                资料完整度：{selectedEvidence?.present ?? 0}/{selectedEvidence?.total ?? 0}
              </span>
              {Object.entries(selectedCompleteness).map(([key, value]) => (
                <span key={key} className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
                  {EVIDENCE_LABELS[key] || key}：{EVIDENCE_STATUS_LABELS[value] || value}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <p className="font-medium text-[var(--color-fg)]">资料输入</p>
                <p className="mt-0.5 text-[var(--color-muted)]">趋势、社媒、平台、供应共同支撑</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <p className="font-medium text-[var(--color-fg)]">决策动作</p>
                <p className="mt-0.5 text-[var(--color-muted)]">九维评分确认去留和优先级</p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <p className="font-medium text-[var(--color-fg)]">下游结果</p>
                <p className="mt-0.5 text-[var(--color-muted)]">绿灯商品进入 Listing 制作</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function normalizeEvidenceSummary(value: unknown): EvidenceSummary {
  const summary = value && typeof value === 'object' ? value as Partial<Record<keyof EvidenceSummary, unknown>> : {}
  const total = toCount(summary.total)
  const present = toCount(summary.present)
  const missing = toCount(summary.missing)
  const stale = toCount(summary.stale)
  const low_confidence = toCount(summary.low_confidence)
  return { total, present, missing, stale, low_confidence }
}

function toCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0
}
