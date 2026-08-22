import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Clock, Database, FileWarning, RefreshCw, ShieldCheck } from 'lucide-react'
import { updateBusinessFlowTasks } from '../../api/businessFlow'
import { createRiskOperationAction, getRiskControlAudit, getRiskControlOverview, updateRiskControlState } from '../../api/riskControl'
import { CommandCenterFrame } from '../../components/shared/CommandCenterFrame'
import { Badge } from '../../components/ui/Badge'
import type { RiskAuditItem, RiskControlOverview, RiskControlRisk } from '../../types/riskControl'
import { logger } from '../../utils/logger'
import { formatTime, StatusPill } from '../cockpit/CockpitCommandWidgets'
import { normalizeRiskControlOverview } from './riskControlCompat'
import { RiskControlMainPanels } from './RiskControlMainPanels'
import { RiskStoreCommandBoard } from './RiskStoreCommandBoard'
import { Metric, RiskSlaTemplateStrip, RiskSourceSummaryPanel } from './RiskControlWorkspaceParts'

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
    <div className="risk-shell space-y-4">
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

      <RiskControlMainPanels
        data={data}
        risks={risks}
        selected={selected}
        audits={audits}
        loading={loading}
        saving={saving}
        taskSaving={taskSaving}
        operationSaving={operationSaving}
        onReload={load}
        onSelectRisk={setSelectedId}
        onNavigate={navigate}
        onCreateBusinessTask={createBusinessTask}
        onCreateOperationAction={createOperationAction}
        onStateChange={changeState}
      />
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
