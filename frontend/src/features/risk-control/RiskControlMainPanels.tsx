import { AlertTriangle, ArrowRight, Database, FileWarning, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import type { RiskAuditItem, RiskControlOverview, RiskControlRisk } from '../../types/riskControl'
import { formatTime, LevelIcon } from '../cockpit/CockpitCommandWidgets'
import { RiskActionPanel } from './RiskActionPanel'
import { RiskEvidencePanel } from './RiskEvidencePanel'
import { RiskSignalBoard } from './RiskSignalBoard'
import { LocationGapQueuePanel, RiskDispositionStatusCard, RiskQueueDensityBar, statusText } from './RiskControlWorkspaceParts'

export function RiskControlMainPanels({
  data,
  risks,
  selected,
  audits,
  loading,
  saving,
  taskSaving,
  operationSaving,
  onReload,
  onSelectRisk,
  onNavigate,
  onCreateBusinessTask,
  onCreateOperationAction,
  onStateChange,
}: {
  data: RiskControlOverview | null
  risks: RiskControlRisk[]
  selected?: RiskControlRisk
  audits: RiskAuditItem[]
  loading: boolean
  saving: boolean
  taskSaving: boolean
  operationSaving: boolean
  onReload: () => void
  onSelectRisk: (riskId: string) => void
  onNavigate: (route: string) => void
  onCreateBusinessTask: (risk: RiskControlRisk) => void
  onCreateOperationAction: (risk: RiskControlRisk) => void
  onStateChange: (risk: RiskControlRisk, status: RiskControlRisk['status'], note?: string, dueAt?: string | null) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)_320px]">
      <section className="risk-command-panel rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4" data-ui="risk-v5-queue-panel">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">风险队列</h2>
          <Badge variant="outline" className="ml-auto">{risks.length}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(data?.risk_categories ?? []).slice(0, 5).map((category) => (
            <button key={category.key} onClick={() => onNavigate(category.route)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
              {category.label} · {category.active_count || (category.status === 'data_required' ? '待补' : 0)}
            </button>
          ))}
        </div>
        {data && <LocationGapQueuePanel data={data} onNavigate={onNavigate} />}
        <RiskQueueDensityBar risks={risks} />
        <div className="mt-3 space-y-2">
          {risks.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] p-3">
              <p className="text-xs text-[var(--color-muted)]">
                {data?.assessment_status === 'insufficient' ? '风险判断数据尚不完整，请按右侧缺口补齐数据后重新评估。' : '已覆盖数据范围内暂无可追溯风险。'}
              </p>
              <button onClick={onReload} disabled={loading} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />重新评估
              </button>
            </div>
          ) : risks.map((risk) => (
            <button
              key={risk.id}
              onClick={() => onSelectRisk(risk.id)}
              className={`risk-signal-row w-full rounded-[var(--radius-lg)] p-3 text-left ${selected?.id === risk.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-[var(--shadow-sm)]' : ''}`}
            >
              <div className="flex items-start gap-2">
                <LevelIcon level={risk.severity === 'critical' ? 'danger' : risk.severity === 'warning' ? 'warning' : 'info'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[var(--color-fg)]">{risk.title}</p>
                  <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">
                    {(risk.platform || '平台待定位')} · {(risk.account_name || '店铺待定位')} · {risk.market || '市场待补'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{risk.detail}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">预计影响：{risk.estimated_impact}</p>
                  <p className={risk.is_overdue ? 'mt-1 text-[11px] text-[var(--color-danger)]' : 'mt-1 text-[11px] text-[var(--color-muted)]'}>
                    处理时限：{risk.due_at || risk.response_deadline_at ? formatTime(risk.due_at || risk.response_deadline_at || '') : '未设置'} · 剩余处理：{risk.remaining_time_label}{risk.is_overdue ? ' · 已逾期' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={risk.severity === 'critical' ? 'danger' : risk.severity === 'warning' ? 'warning' : 'info'}>{risk.type_label || risk.type}</Badge>
                  <span className={risk.is_overdue ? 'text-[11px] text-[var(--color-danger)]' : 'text-[11px] text-[var(--color-muted)]'}>
                    {risk.is_overdue ? '已逾期' : statusText(risk.status)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="risk-command-panel rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4" data-ui="risk-v5-detail-panel">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">风险详情</h2>
        </div>
        {!selected ? (
          <p className="mt-3 rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">当前没有风险需要处理。</p>
        ) : (
          <>
            <RiskEvidencePanel risk={selected} audits={audits} onOpen={() => onNavigate(selected.route)} />
            {data && <RiskSignalBoard data={data} onNavigate={onNavigate} />}
          </>
        )}
      </section>

      <section className="risk-command-panel rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4" data-ui="risk-v5-action-panel">
        {selected && (
          <>
            <RiskDispositionStatusCard risk={selected} />
            <div className="mt-4">
              <RiskActionPanel
                risk={selected}
                saving={saving}
                taskSaving={taskSaving}
                operationSaving={operationSaving}
                onOpen={() => onNavigate(selected.route)}
                onCreateBusinessTask={() => onCreateBusinessTask(selected)}
                onCreateOperationAction={() => onCreateOperationAction(selected)}
                onStateChange={(status, note, dueAt) => onStateChange(selected, status, note, dueAt)}
              />
            </div>
          </>
        )}
        <div className={selected ? 'mt-5 border-t border-[var(--color-border)] pt-4' : ''}>
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-[var(--color-info)]" />
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">处置建议</h2>
            </div>
            {(data?.ai_recommendations ?? []).length === 0 ? (
              <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无基于当前风险对象的处置建议。</p>
            ) : (data?.ai_recommendations ?? []).slice(0, 3).map((item) => (
              <button key={item.risk_id} onClick={() => onNavigate(item.route)} className="mb-2 w-full rounded-md bg-[var(--color-bg)] px-2 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]">
                <span className="text-xs font-semibold text-[var(--color-fg)]">{item.title}</span>
                <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{item.recommendation}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">数据缺口</h2>
          </div>
          <div className="mt-3 space-y-2">
            {(data?.gaps ?? []).length === 0 ? (
              <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">未发现跨模块数据缺口。</p>
            ) : (data?.gap_actions ?? []).slice(0, 8).map((gap) => (
              <button key={`${gap.category}-${gap.detail}`} onClick={() => onNavigate(gap.route)} className="w-full rounded-md bg-[var(--color-bg)] px-2 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]">
                <span className="flex items-center justify-between text-[11px] text-[var(--color-muted)]"><span>{gap.category}</span><span>优先级 {gap.priority}</span></span>
                <span className="mt-1 block text-xs text-[var(--color-warning)]">{gap.detail}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)]">{gap.action_label || '前往处理'} <ArrowRight className="h-3 w-3" /></span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
