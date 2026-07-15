import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Clock, Database, FileWarning, RefreshCw, ShieldCheck } from 'lucide-react'
import { updateBusinessFlowTasks } from '../../api/businessFlow'
import { getRiskControlAudit, getRiskControlOverview, updateRiskControlState } from '../../api/riskControl'
import { CommandCenterFrame } from '../../components/shared/CommandCenterFrame'
import { Badge } from '../../components/ui/Badge'
import type { RiskAuditItem, RiskControlOverview, RiskControlRisk } from '../../types/riskControl'
import { logger } from '../../utils/logger'
import { formatTime, LevelIcon, StatusPill } from '../cockpit/CockpitCommandWidgets'
import { RiskEvidencePanel } from './RiskEvidencePanel'
import { RiskActionPanel } from './RiskActionPanel'
import { normalizeRiskControlOverview } from './riskControlCompat'
import { RiskSignalBoard } from './RiskSignalBoard'
import { RiskStoreCommandBoard } from './RiskStoreCommandBoard'

export default function RiskControlWorkspace() {
  const navigate = useNavigate()
  const [data, setData] = useState<RiskControlOverview | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [audits, setAudits] = useState<RiskAuditItem[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getRiskControlOverview()
      const next = normalizeRiskControlOverview(response.data || null)
      setData(next)
      setSelectedId((current) => current || next?.risks[0]?.id || '')
    } catch (e: any) {
      logger.error('风险管控台加载失败', e)
      setError(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const risks = useMemo(() => data?.risks ?? [], [data])
  const selected = risks.find((item) => item.id === selectedId) || risks[0]

  const loadAudit = useCallback(async (riskId: string) => {
    try {
      const response = await getRiskControlAudit(riskId)
      setAudits(response.data || [])
    } catch (e: any) {
      logger.error('风险审计加载失败', e)
      setAudits([])
    }
  }, [])

  useEffect(() => {
    if (selected?.id) {
      loadAudit(selected.id)
    } else {
      setAudits([])
    }
  }, [loadAudit, selected?.id])

  const changeState = useCallback(async (risk: RiskControlRisk, status: RiskControlRisk['status'], note?: string, dueAt?: string | null) => {
    setSaving(true)
    try {
      await updateRiskControlState(risk.id, { status, note, due_at: dueAt })
      setSelectedId(risk.id)
      await load()
      await loadAudit(risk.id)
    } catch (e: any) {
      logger.error('风险状态更新失败', e)
      setError(e?.response?.data?.detail || e?.message || '风险状态更新失败')
    } finally {
      setSaving(false)
    }
  }, [load])

  const createBusinessTask = useCallback(async (risk: RiskControlRisk) => {
    setTaskSaving(true)
    setError('')
    try {
      await updateBusinessFlowTasks({
        action: 'set_priority',
        priority: risk.severity === 'critical' ? 'urgent' : 'high',
        note: `风险转任务：${risk.detail}`,
        items: [{
          item_type: 'risk_event',
          item_id: risk.id,
          stage_key: 'optimization',
          title: risk.title,
          route: risk.route || '/risk-control',
          source_refs: risk.source_refs,
          last_gap: risk.detail,
        }],
      })
      navigate('/business-flow')
    } catch (e: any) {
      logger.error('风险生成业务任务失败', e)
      setError(e?.response?.data?.detail || e?.message || '风险生成业务任务失败')
    } finally {
      setTaskSaving(false)
    }
  }, [navigate])

  if (loading && !data) return <p className="text-sm text-[var(--color-muted)]">正在聚合真实风险数据...</p>
  if (error && !data) return <p className="text-sm text-[var(--color-danger)]">{error}</p>

  return (
    <div className="space-y-4">
      <CommandCenterFrame
        eyebrow="Risk Command"
        title="风险处置中枢"
        description="按平台规则风险、履约风险、库存资金风险和店铺经营风险集中管控，支持按平台、店铺和业务对象下钻处置。"
        badge={(
          <Badge variant={data?.assessment_status === 'attention' ? 'warning' : data?.assessment_status === 'insufficient' ? 'info' : 'success'}>
            {data?.assessment_status === 'attention' ? '存在待处理风险' : data?.assessment_status === 'insufficient' ? '数据不足，暂无法确认风险' : '已覆盖范围内未识别到风险'}
          </Badge>
        )}
        actions={(
          <>
            <StatusPill icon={<FileWarning className="h-3.5 w-3.5" />} label="待处理" value={`${data?.metrics.pending ?? 0} 项`} />
            <StatusPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="处理中" value={`${data?.metrics.processing ?? 0} 项`} />
            <StatusPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="类型" value={`${data?.metrics.category_count ?? 0} 类`} />
            <StatusPill icon={<Database className="h-3.5 w-3.5" />} label="来源" value={`${data?.metrics.source_count ?? 0} 条`} />
            <StatusPill icon={<Clock className="h-3.5 w-3.5" />} label="更新" value={data ? formatTime(data.generated_at) : '-'} />
            <button
              onClick={load}
              disabled={loading}
              title="刷新风险管控台"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-primary-text)] transition hover:-translate-y-0.5 hover:border-[var(--color-command-accent)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        )}
      >
        <div aria-label="风险处置指标" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
          <Metric label="高风险" value={String(data?.metrics.critical ?? 0)} tone="danger" />
          <Metric label="警告" value={String(data?.metrics.warning ?? 0)} tone="warning" />
          <Metric label="SLA逾期" value={String(data?.metrics.overdue ?? 0)} tone="danger" />
          <Metric label="处理中" value={String(data?.metrics.processing ?? 0)} tone="info" />
          <Metric label="数据缺口" value={String(data?.gaps?.length ?? 0)} tone="warning" />
          <Metric label="已关闭" value={String(data?.metrics.closed ?? 0)} tone="ready" />
        </div>
      </CommandCenterFrame>

      {data && <RiskStoreCommandBoard data={data} onNavigate={navigate} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)_320px]">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">风险队列</h2>
            <Badge variant="outline" className="ml-auto">{risks.length}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.risk_categories ?? []).slice(0, 5).map((category) => (
              <button key={category.key} onClick={() => navigate(category.route)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                {category.label} · {category.active_count || (category.status === 'data_required' ? '待补' : 0)}
              </button>
            ))}
          </div>
          <RiskQueueDensityBar risks={risks} />
          <div className="mt-3 space-y-2">
            {risks.length === 0 ? (
              <div className="rounded-md border border-[var(--color-border)] p-3">
                <p className="text-xs text-[var(--color-muted)]">
                  {data?.assessment_status === 'insufficient' ? '风险判断数据尚不完整，请按右侧缺口补齐数据后重新评估。' : '已覆盖数据范围内暂无可追溯风险。'}
                </p>
                <button onClick={load} disabled={loading} className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] disabled:opacity-50">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />重新评估
                </button>
              </div>
            ) : risks.map((risk) => (
              <button
                key={risk.id}
                onClick={() => setSelectedId(risk.id)}
                className={`w-full rounded-md border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] ${selected?.id === risk.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}
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

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">风险详情</h2>
          </div>
          {!selected ? (
            <p className="mt-3 rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">当前没有风险需要处理。</p>
          ) : (
            <>
              <RiskEvidencePanel risk={selected} audits={audits} onOpen={() => navigate(selected.route)} />
              {data && <RiskSignalBoard data={data} onNavigate={navigate} />}
            </>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
          {selected && (
            <>
              <RiskDispositionStatusCard risk={selected} />
              <div className="mt-4">
                <RiskActionPanel risk={selected} saving={saving} taskSaving={taskSaving} onOpen={() => navigate(selected.route)} onCreateBusinessTask={() => createBusinessTask(selected)} onStateChange={(status, note, dueAt) => changeState(selected, status, note, dueAt)} />
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
                <button key={item.risk_id} onClick={() => navigate(item.route)} className="mb-2 w-full rounded-md bg-[var(--color-bg)] px-2 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]">
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
              <button key={`${gap.category}-${gap.detail}`} onClick={() => navigate(gap.route)} className="w-full rounded-md bg-[var(--color-bg)] px-2 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]">
                <span className="flex items-center justify-between text-[11px] text-[var(--color-muted)]"><span>{gap.category}</span><span>优先级 {gap.priority}</span></span>
                <span className="mt-1 block text-xs text-[var(--color-warning)]">{gap.detail}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)]">{gap.action_label || '前往处理'} <ArrowRight className="h-3 w-3" /></span>
              </button>
            ))}
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'warning' | 'info' | 'ready' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : tone === 'info' ? 'var(--color-info)' : 'var(--color-success)'
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold" style={{ color }}>{value}</p>
    </div>
  )
}

function RiskQueueDensityBar({ risks }: { risks: RiskControlRisk[] }) {
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

function RiskDispositionStatusCard({ risk }: { risk: RiskControlRisk }) {
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

function statusText(status: RiskControlRisk['status']) {
  if (status === 'processing') return '处理中'
  if (status === 'closed') return '已关闭'
  if (status === 'ignored') return '已忽略'
  return '待处理'
}
