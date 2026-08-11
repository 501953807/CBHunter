import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Boxes, CalendarRange, Clock, Database, FileWarning, RefreshCw, ShieldCheck, Truck, WalletCards } from 'lucide-react'
import { updateBusinessFlowTasks } from '../../api/businessFlow'
import { createRiskOperationAction, getRiskControlAudit, getRiskControlOverview, updateRiskControlState } from '../../api/riskControl'
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
  const riskDateShortcuts = useMemo(() => buildRiskDateShortcuts(new Date()), [])
  const [riskDateDraft, setRiskDateDraft] = useState<RiskDateRange>({})
  const [appliedRiskDateRange, setAppliedRiskDateRange] = useState<RiskDateRange>({})
  const [data, setData] = useState<RiskControlOverview | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [operationSaving, setOperationSaving] = useState(false)
  const [audits, setAudits] = useState<RiskAuditItem[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getRiskControlOverview(cleanRiskDateRange(appliedRiskDateRange))
      const next = normalizeRiskControlOverview(response.data || null)
      setData(next)
      setSelectedId((current) => current || next?.risks[0]?.id || '')
    } catch (e: any) {
      logger.error('风险管控台加载失败', e)
      setError(e?.response?.data?.detail || e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [appliedRiskDateRange])

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

  const createOperationAction = useCallback(async (risk: RiskControlRisk) => {
    setOperationSaving(true)
    setError('')
    try {
      await createRiskOperationAction(risk.id)
      navigate('/operations?record_type=listing_optimization')
    } catch (e: any) {
      logger.error('风险生成运营台账动作失败', e)
      setError(e?.response?.data?.detail || e?.message || '风险生成运营台账动作失败')
    } finally {
      setOperationSaving(false)
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
        <RiskDateRangeFilter
          value={riskDateDraft}
          shortcuts={riskDateShortcuts}
          loading={loading}
          activeWindow={data?.comparison.windows.current}
          onChange={setRiskDateDraft}
          onApply={() => setAppliedRiskDateRange(cleanRiskDateRange(riskDateDraft))}
          onReset={() => {
            setRiskDateDraft({})
            setAppliedRiskDateRange({})
          }}
        />
        <div aria-label="风险处置指标" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-6" data-ui="risk-v5-command-metric-grid">
          <Metric label="高风险" value={String(data?.metrics.critical ?? 0)} tone="danger" />
          <Metric label="警告" value={String(data?.metrics.warning ?? 0)} tone="warning" />
          <Metric label="SLA逾期" value={String(data?.metrics.overdue ?? 0)} tone="danger" />
          <Metric label="处理中" value={String(data?.metrics.processing ?? 0)} tone="info" />
          <Metric label="数据缺口" value={String(data?.gaps?.length ?? 0)} tone="warning" />
          <Metric label="已关闭" value={String(data?.metrics.closed ?? 0)} tone="ready" />
        </div>
        {data && <RiskSlaTemplateStrip data={data} onOpenConfig={() => navigate('/settings/keys')} />}
      </CommandCenterFrame>

      {data && <RiskSourceSummaryPanel data={data} onNavigate={navigate} />}

      {data && <RiskStoreCommandBoard data={data} onNavigate={navigate} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)_320px]">
        <section className="risk-command-panel rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-4" data-ui="risk-v5-queue-panel">
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
          {data && <LocationGapQueuePanel data={data} onNavigate={navigate} />}
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
              <RiskEvidencePanel risk={selected} audits={audits} onOpen={() => navigate(selected.route)} />
              {data && <RiskSignalBoard data={data} onNavigate={navigate} />}
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
                  onOpen={() => navigate(selected.route)}
                  onCreateBusinessTask={() => createBusinessTask(selected)}
                  onCreateOperationAction={() => createOperationAction(selected)}
                  onStateChange={(status, note, dueAt) => changeState(selected, status, note, dueAt)}
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

interface RiskDateRange {
  start_date?: string
  end_date?: string
}

interface RiskDateShortcut {
  key: 'week_to_date' | 'month_to_date' | 'quarter_to_date'
  label: string
  detail: string
  startDate: string
  endDate: string
}

function RiskDateRangeFilter({
  value,
  shortcuts,
  loading,
  activeWindow,
  onChange,
  onApply,
  onReset,
}: {
  value: RiskDateRange
  shortcuts: RiskDateShortcut[]
  loading: boolean
  activeWindow?: string
  onChange: (value: RiskDateRange) => void
  onApply: () => void
  onReset: () => void
}) {
  const applyShortcut = (shortcut: RiskDateShortcut) => {
    onChange({ start_date: shortcut.startDate, end_date: shortcut.endDate })
  }

  return (
    <section
      aria-label="风险日期快捷窗口"
      data-ui="risk-date-range-filter"
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-[var(--color-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">风险日期范围</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">当前风险统计：{activeWindow || '后端默认最近 30 个自然日'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((shortcut) => {
            const active = value.start_date === shortcut.startDate && value.end_date === shortcut.endDate
            return (
              <button
                key={shortcut.key}
                type="button"
                disabled={loading}
                title={`${shortcut.label}：${shortcut.detail}`}
                onClick={() => applyShortcut(shortcut)}
                className="rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50"
                style={{
                  borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                  background: active ? 'var(--color-primary-light)' : 'var(--color-surface)',
                  color: active ? 'var(--color-primary)' : 'var(--color-muted)',
                }}
              >
                <span className="font-semibold">{shortcut.label}</span>
                <span className="ml-1 text-[11px]">{shortcut.detail}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-xs text-[var(--color-muted)]">
          <span className="mb-1 block">开始日期</span>
          <input
            type="date"
            value={value.start_date || ''}
            onChange={(event) => onChange({ ...value, start_date: event.target.value })}
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]"
          />
        </label>
        <label className="text-xs text-[var(--color-muted)]">
          <span className="mb-1 block">结束日期</span>
          <input
            type="date"
            value={value.end_date || ''}
            onChange={(event) => onChange({ ...value, end_date: event.target.value })}
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-fg)] outline-none transition focus:border-[var(--color-primary)]"
          />
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={onApply}
          className="self-end rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary-text)] transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          应用风险范围
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onReset}
          className="self-end rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
        >
          重置默认
        </button>
      </div>
    </section>
  )
}

function buildRiskDateShortcuts(now: Date): RiskDateShortcut[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = addDays(today, -mondayOffset)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
  const endDate = formatDateLocal(today)
  return [
    { key: 'week_to_date', label: '本周', detail: `${formatDateLocal(weekStart)} 至 ${endDate}`, startDate: formatDateLocal(weekStart), endDate },
    { key: 'month_to_date', label: '本月', detail: `${formatDateLocal(monthStart)} 至 ${endDate}`, startDate: formatDateLocal(monthStart), endDate },
    { key: 'quarter_to_date', label: '本季度', detail: `${formatDateLocal(quarterStart)} 至 ${endDate}`, startDate: formatDateLocal(quarterStart), endDate },
  ]
}

function cleanRiskDateRange(value: RiskDateRange): RiskDateRange {
  return value.start_date && value.end_date ? value : {}
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function RiskSourceSummaryPanel({ data, onNavigate }: { data: RiskControlOverview; onNavigate: (route: string) => void }) {
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

function RiskSlaTemplateStrip({ data, onOpenConfig }: { data: RiskControlOverview; onOpenConfig: () => void }) {
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

function Metric({ label, value, tone }: { label: string; value: string; tone: 'danger' | 'warning' | 'info' | 'ready' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : tone === 'info' ? 'var(--color-info)' : 'var(--color-success)'
  return (
    <div className="risk-command-metric rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]" data-ui="risk-v5-command-metric-card">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color }}>{value}</p>
    </div>
  )
}

function LocationGapQueuePanel({ data, onNavigate }: { data: RiskControlOverview; onNavigate: (route: string) => void }) {
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

function locationGapActionLabel(gapKey: string, fallback?: string) {
  if (gapKey === 'platform') return fallback || '补齐平台归属'
  if (gapKey === 'store') return fallback || '补齐店铺归属'
  if (gapKey === 'market') return fallback || '补齐目标市场'
  return fallback || '补齐定位信息'
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

function riskTypeLabel(type: string) {
  if (type === 'account') return '账号安全'
  if (type === 'business') return '店铺经营'
  if (type === 'compliance') return '合规/IP'
  if (type === 'logistics') return '物流时效'
  if (type === 'currency') return '汇率利润'
  if (type === 'inventory') return '库存供货'
  return type
}
