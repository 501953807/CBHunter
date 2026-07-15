import { Badge } from '../../components/ui/Badge'
import type { RiskControlOverview } from '../../types/riskControl'
import { formatTime } from '../cockpit/CockpitCommandWidgets'

interface Props {
  data: RiskControlOverview
  onNavigate: (route: string) => void
}

export function RiskSignalBoard({ data, onNavigate }: Props) {
  return (
    <div className="mt-4 space-y-3">
      <RiskDispositionMatrix data={data} onNavigate={onNavigate} />
      <div className="grid gap-3 2xl:grid-cols-2">
        <RiskHeatmapPanel data={data} onNavigate={onNavigate} />
        <RiskReviewPanel data={data} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function RiskHeatmapPanel({ data, onNavigate }: Props) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">风险雷达</p>
      <div className="space-y-1.5">
        {data.risk_heatmap.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">暂无热力分布数据。</p>
        ) : data.risk_heatmap.slice(0, 5).map((item) => (
          <button key={item.category} onClick={() => onNavigate(item.route)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-left transition hover:border-[var(--color-primary)]">
            <span className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--color-fg)]">{item.label}</span>
              <Badge variant={item.heat_level === 'critical' ? 'danger' : item.heat_level === 'warning' ? 'warning' : item.heat_level === 'data_required' ? 'info' : 'success'}>{item.total}</Badge>
            </span>
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
              高危 {item.critical} · 警告 {item.warning} · 处理中 {item.processing} · 已关闭 {item.closed}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function RiskDispositionMatrix({ data, onNavigate }: Props) {
  return (
    <section aria-label="风险处置矩阵" className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-fg)]">风险处置矩阵</p>
        <Badge variant="outline">按评分 / 高危 / 逾期排序</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data.risk_radar.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无风险评分数据。</p>
        ) : data.risk_radar.slice(0, 6).map((item) => (
          <button key={item.key} onClick={() => onNavigate(item.route)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-[var(--color-fg)]">{item.label}</span>
              <span className={item.score >= 80 ? 'text-xs font-semibold text-[var(--color-danger)]' : item.score >= 50 ? 'text-xs font-semibold text-[var(--color-warning)]' : 'text-xs font-semibold text-[var(--color-success)]'}>{item.score}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
              <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(4, item.score))}%`, background: item.score >= 80 ? 'var(--color-danger)' : item.score >= 50 ? 'var(--color-warning)' : 'var(--color-success)' }} />
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-[var(--color-muted)]">
              <span>活跃 {item.active_count}</span>
              <span>高危 {item.critical}</span>
              <span>逾期 {item.overdue}</span>
              <span>{item.status === 'data_required' ? '资料待补' : item.status === 'attention' ? '需处置' : '清晰'}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function RiskReviewPanel({ data, onNavigate }: Props) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">处置复盘</p>
      <div className="space-y-1.5">
        {data.review_records.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">暂无已关闭风险复盘。</p>
        ) : data.review_records.slice(0, 5).map((item) => (
          <button key={item.risk_id} onClick={() => onNavigate(item.route)} className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-left transition hover:border-[var(--color-primary)]">
            <span className="block truncate text-xs font-medium text-[var(--color-fg)]">{item.title}</span>
            <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
              {item.type_label || item.type} · {item.closed_at ? formatTime(item.closed_at) : '关闭时间待补'}
            </span>
            {item.note && <span className="mt-1 block truncate text-[11px] text-[var(--color-muted)]">{item.note}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
