import { ArrowRight, Boxes, ShieldCheck, Truck, WalletCards } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { RiskControlOverview, RiskControlRisk } from '../../types/riskControl'
import { formatTime } from '../cockpit/CockpitCommandWidgets'

export function RiskSlaTemplateStrip({ data, onOpenConfig }: { data: RiskControlOverview; onOpenConfig: () => void }) {
  const templateRows = Object.entries(data.risk_sla_templates || {}).slice(0, 6)
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">风险 SLA 模板</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            无平台原生时限的风险按类型和严重级别自动补处理时限；可在设置中心编辑 risk.sla_templates，订单履约风险优先使用平台发货时限。
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenConfig}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
        >
          进入 SLA 配置
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {templateRows.map(([key, template]) => (
          <div key={key} className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-[11px]">
            <p className="font-medium text-[var(--color-fg)]">{riskTypeLabel(key)}</p>
            <p className="mt-1 text-[var(--color-muted)]">高危 {template.critical}h · 警告 {template.warning}h</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Metric({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'warning' | 'info' | 'ready' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : tone === 'info' ? 'var(--color-info)' : 'var(--color-success)'
  return (
    <div className="risk-command-metric rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]" data-ui="risk-v5-command-metric-card">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
    </div>
  )
}

export function LocationGapQueuePanel({ data, onNavigate }: { data: RiskControlOverview; onNavigate: (route: string) => void }) {
  const rows = data.location_gap_queue || []
  if (!rows.length) return null
  return (
    <section aria-label="待定位信息合并队列" className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-fg)]">待定位信息合并队列</p>
          <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">将平台、店铺、目标市场缺失的风险合并处理，避免风险队列被“待定位”刷屏。</p>
        </div>
        <Badge variant="warning">{rows.reduce((sum, item) => sum + item.risk_count, 0)} 项</Badge>
      </div>
      <div className="mt-2 space-y-1.5">
        {rows.map((item) => (
          <button
            key={item.gap_key}
            type="button"
            onClick={() => onNavigate(item.route)}
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-left transition hover:border-[var(--color-primary)]"
          >
            <span className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[var(--color-fg)]">{item.label}</span>
              <span className="text-[var(--color-warning)]">风险 {item.risk_count} · 高危 {item.critical}</span>
            </span>
            <span className="mt-1 block line-clamp-1 text-[10px] text-[var(--color-muted)]">
              样例：{item.sample_risks.map((risk) => risk.title || risk.id).join('、') || '待补风险样例'}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--color-primary)]">
              {locationGapActionLabel(item.gap_key, item.action_label)}<ArrowRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function RiskQueueDensityBar({ risks }: { risks: RiskControlRisk[] }) {
  const critical = risks.filter((risk) => risk.severity === 'critical').length
  const warning = risks.filter((risk) => risk.severity === 'warning').length
  const overdue = risks.filter((risk) => risk.is_overdue).length
  const processing = risks.filter((risk) => risk.status === 'processing').length
  return (
    <section aria-label="队列密度" className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-[var(--color-fg)]">队列密度</p>
        <p className="text-[11px] text-[var(--color-muted)]">风险排序：高危 / 逾期 / 处理中优先</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 text-[11px]">
        <DensityItem label="高危" value={critical} tone="danger" />
        <DensityItem label="警告" value={warning} tone="warning" />
        <DensityItem label="逾期" value={overdue} tone="danger" />
        <DensityItem label="处理中" value={processing} tone="info" />
      </div>
    </section>
  )
}

function DensityItem({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'info' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-info)'
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1">
      <p className="text-[var(--color-muted)]">{label}</p>
      <p className="font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}

function locationGapActionLabel(gapKey: string, fallback?: string) {
  if (gapKey === 'platform') return fallback || '补齐平台归属'
  if (gapKey === 'store') return fallback || '补齐店铺归属'
  if (gapKey === 'market') return fallback || '补齐目标市场'
  return fallback || '补齐定位信息'
}

function riskTypeLabel(type: string) {
  if (type === 'account') return '账号安全'
  if (type === 'business') return '店铺经营'
  if (type === 'compliance') return '合规/IP'
  if (type === 'logistics') return '物流时效'
  if (type === 'currency') return '汇率利润'
  if (type === 'inventory') return '库存供货'
  return type
}

export function RiskSourceSummaryPanel({ data, onNavigate }: { data: RiskControlOverview; onNavigate: (route: string) => void }) {
  const rows = data.risk_source_summary || []
  if (!rows.length) return null
  return (
    <section data-ui="risk-stage2-signal-summary" aria-label="履约库存利润风险源汇总" className="grid gap-3 md:grid-cols-3">
      {rows.map((item) => {
        const tone = item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warning' : 'success'
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.route)}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]"
          >
            <div className="flex items-start gap-3">
              <RiskSourceIcon type={item.key} severity={item.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-fg)]">{riskSourceLabel(item.key, item.label)}</p>
                  <Badge variant={tone}>{item.severity === 'critical' ? '高危' : item.severity === 'warning' ? '预警' : '正常'}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.description}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniSourceMetric label="主风险" value={String(item.count)} tone={tone === 'success' ? 'ready' : tone} />
                  <MiniSourceMetric label={item.secondary_label} value={String(item.secondary_count)} tone={item.secondary_count ? 'warning' : 'ready'} />
                  <MiniSourceMetric label="队列" value={String(item.active_risk_count)} tone={item.active_risk_count ? 'warning' : 'ready'} />
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)]">
                  {item.data_gaps.length ? `待补 ${item.data_gaps.length} 项数据` : '进入处理列表'}<ArrowRight className="h-3 w-3" />
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )
}

function RiskSourceIcon({ type, severity }: { type: string; severity: string }) {
  const color = severity === 'critical' ? 'var(--color-danger)' : severity === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'
  const className = "h-5 w-5"
  const icon = type === 'fulfillment_overdue'
    ? <Truck className={className} style={{ color }} />
    : type === 'inventory_stockout'
      ? <Boxes className={className} style={{ color }} />
      : type === 'profit_anomaly'
        ? <WalletCards className={className} style={{ color }} />
      : <WalletCards className={className} style={{ color }} />
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      {icon}
    </span>
  )
}

function riskSourceLabel(type: string, fallback: string) {
  if (type === 'fulfillment_overdue') return '履约超时'
  if (type === 'inventory_stockout') return '库存断货'
  if (type === 'profit_anomaly') return '利润异常'
  return fallback
}

function MiniSourceMetric({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'warning' | 'ready' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1">
      <span className="block text-[10px] text-[var(--color-muted)]">{label}</span>
      <span className="block text-sm font-semibold" style={{ color }}>{value}</span>
    </span>
  )
}

export function RiskDispositionStatusCard({ risk }: { risk: RiskControlRisk }) {
  const deadline = risk.due_at || risk.response_deadline_at
  const slaText = deadline ? `${formatTime(deadline)} · ${risk.remaining_time_label}${risk.is_overdue ? ' · 已逾期' : ''}` : '未设置'
  const nextStep = risk.status === 'pending'
    ? '应先标记处理中并分派处理时间'
    : risk.status === 'processing'
      ? '补齐来源记录后关闭或转业务任务'
      : '已结束，必要时可重新打开'
  return (
    <section aria-label="处置状态" className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">处置状态</h2>
        <Badge variant={risk.is_overdue ? 'danger' : risk.status === 'processing' ? 'info' : risk.status === 'pending' ? 'warning' : 'success'} className="ml-auto">
          {statusText(risk.status)}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStatus label="SLA状态" value={slaText} danger={risk.is_overdue} />
        <MiniStatus label="预计影响" value={risk.estimated_impact} danger={risk.severity === 'critical'} />
        <MiniStatus label="剩余处理" value={risk.remaining_time_label} danger={risk.is_overdue} />
        <MiniStatus label="来源记录" value={`${risk.source_refs.length} 条`} danger={risk.source_refs.length === 0} />
      </div>
      <p className="mt-3 rounded-md border border-[var(--color-border)] px-2 py-2 text-[11px] text-[var(--color-muted)]">
        下一步：{nextStep}
      </p>
    </section>
  )
}

function MiniStatus({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className={danger ? 'mt-1 truncate text-xs font-semibold text-[var(--color-danger)]' : 'mt-1 truncate text-xs font-semibold text-[var(--color-fg)]'}>{value}</p>
    </div>
  )
}

export function statusText(status: RiskControlRisk['status']) {
  if (status === 'processing') return '处理中'
  if (status === 'closed') return '已关闭'
  if (status === 'ignored') return '已忽略'
  return '待处理'
}
