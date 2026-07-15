import { ArrowRight } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { RiskAuditItem, RiskControlRisk } from '../../types/riskControl'
import { formatTime, LevelIcon } from '../cockpit/CockpitCommandWidgets'

interface Props {
  risk: RiskControlRisk
  audits: RiskAuditItem[]
  onOpen: () => void
}

export function RiskEvidencePanel({ risk, audits, onOpen }: Props) {
  return (
    <div className="mt-3 space-y-4">
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="flex items-start gap-2">
          <LevelIcon level={risk.severity === 'critical' ? 'danger' : risk.severity === 'warning' ? 'warning' : 'info'} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-[var(--color-fg)]">{risk.title}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{risk.detail}</p>
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">预计影响：{risk.estimated_impact}</p>
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">
              类型 {risk.type_label || risk.type} · 状态 {statusText(risk.status)}{risk.assigned_to ? ` · 负责人 ${risk.assigned_to}` : ''}{risk.updated_at ? ` · 更新 ${formatTime(risk.updated_at)}` : ''}
            </p>
            {(risk.due_at || risk.response_deadline_at) && (
              <p className={risk.is_overdue ? 'mt-1 text-[11px] text-[var(--color-danger)]' : 'mt-1 text-[11px] text-[var(--color-muted)]'}>
                预计处理 {formatTime(risk.due_at || risk.response_deadline_at || '')} · 剩余处理：{risk.remaining_time_label}{risk.is_overdue ? ' · 已逾期' : ''}
              </p>
            )}
          </div>
          <button onClick={onOpen} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-primary)]">
            打开业务记录 <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <InfoText label="数据范围" value={risk.evidence_window || '待补充数据范围'} />
      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">关联业务记录</p>
        <div className="grid gap-2 md:grid-cols-2">
          {risk.source_refs.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <Badge variant="warning">来源待补</Badge>
              <p className="mt-2 text-[11px] text-[var(--color-muted)]">当前风险缺少可追溯业务记录，请先补齐真实业务数据。</p>
            </div>
          ) : risk.source_refs.slice(0, 10).map((ref) => (
            <RiskEvidenceCard key={`${ref.type}-${ref.id}`} refItem={ref} />
          ))}
        </div>
      </div>
      <AuditTimeline audits={audits} />
    </div>
  )
}

function RiskEvidenceCard({ refItem }: { refItem: RiskControlRisk['source_refs'][number] }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline">{refItem.meta?.source_label || refItem.type}</Badge>
        {refItem.meta?.route && <span className="text-[11px] text-[var(--color-primary)]">可下钻</span>}
      </div>
      <p className="mt-2 truncate text-xs font-semibold text-[var(--color-fg)]">{refItem.label || '业务记录'}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">业务记录编号：{refItem.id}</p>
    </div>
  )
}

function AuditTimeline({ audits }: { audits: RiskAuditItem[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[var(--color-fg)]">处理时间线</p>
      {audits.length === 0 ? (
        <p className="rounded-md bg-[var(--color-bg)] p-2 text-xs text-[var(--color-muted)]">暂无处理记录。</p>
      ) : (
        <div aria-label="风险处理时间线" className="space-y-0">
          {audits.slice(0, 5).map((item) => (
            <TimelineNode key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineNode({ item }: { item: RiskAuditItem }) {
  return (
    <div className="relative border-l border-[var(--color-border)] pb-3 pl-4 last:pb-0">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-surface)]" />
      <div className="rounded-md bg-[var(--color-bg)] p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[var(--color-fg)]">{auditActionText(item.action)}</span>
          <span className="text-[11px] text-[var(--color-muted)]">{formatTime(item.created_at)}</span>
        </div>
        {item.detail && <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.detail}</p>}
      </div>
    </div>
  )
}

function InfoText({ label, value }: { label: string; value: string }) {
  return <div><p className="mb-1 text-xs font-semibold text-[var(--color-fg)]">{label}</p><p className="rounded-md bg-[var(--color-bg)] p-2 text-xs text-[var(--color-muted)]">{value}</p></div>
}

function statusText(status: RiskControlRisk['status']) {
  if (status === 'processing') return '处理中'
  if (status === 'closed') return '已关闭'
  if (status === 'ignored') return '已忽略'
  return '待处理'
}

function auditActionText(action: string) {
  if (action === 'risk_processing') return '标记处理中'
  if (action === 'risk_closed') return '关闭风险'
  if (action === 'risk_pending') return '重新打开'
  if (action === 'risk_ignored') return '忽略风险'
  return action
}
