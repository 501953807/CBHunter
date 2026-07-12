import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Box, CircleAlert, DollarSign, ExternalLink, FileText, ShieldCheck, Truck } from 'lucide-react'
import { addBusinessFlowTaskComment, completeBusinessFlowTaskWithReview, getBusinessFlowTaskEvents } from '../../api/businessFlow'
import { Badge } from '../../components/ui/Badge'
import type { BusinessFlowBusItem, BusinessFlowNextAction, BusinessFlowTaskEvent } from '../../types/businessFlow'
import { labelBusinessCode } from '../../utils/businessLabels'
import { logger } from '../../utils/logger'
import { buildObjectRoute } from './businessFlowRoutes'

interface Props {
  item: BusinessFlowBusItem | null
  actions: BusinessFlowNextAction[]
  onNavigate: (route: string) => void
  onReload: () => Promise<void>
}

export function BusinessFlowContextRail({ item, actions, onNavigate, onReload }: Props) {
  const [events, setEvents] = useState<BusinessFlowTaskEvent[]>([])
  const [comment, setComment] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [impactScore, setImpactScore] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadEvents = useCallback(async () => {
    if (!item?.task_id) {
      setEvents([])
      return
    }
    try {
      const response = await getBusinessFlowTaskEvents(item.task_id)
      setEvents(response.data || [])
    } catch (e: any) {
      logger.error('业务任务事件加载失败', e)
      setEvents([])
    }
  }, [item?.task_id])

  useEffect(() => { loadEvents() }, [loadEvents])

  const submitComment = async () => {
    if (!item?.task_id || !comment.trim()) return
    setSaving(true)
    setError('')
    try {
      await addBusinessFlowTaskComment(item.task_id, { comment: comment.trim() })
      setComment('')
      await loadEvents()
    } catch (e: any) {
      logger.error('业务任务备注提交失败', e)
      setError(e?.response?.data?.detail || e?.message || '备注提交失败')
    } finally {
      setSaving(false)
    }
  }

  const completeReview = async () => {
    if (!item?.task_id || !outcome.trim()) return
    setSaving(true)
    setError('')
    try {
      await completeBusinessFlowTaskWithReview(item.task_id, { outcome: outcome.trim(), impact_score: impactScore, next_action: nextAction.trim() || null })
      setOutcome('')
      setNextAction('')
      await loadEvents()
      await onReload()
    } catch (e: any) {
      logger.error('业务任务完成复盘失败', e)
      setError(e?.response?.data?.detail || e?.message || '完成复盘失败')
    } finally {
      setSaving(false)
    }
  }

  if (!item) {
    return (
      <aside className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
        <p className="rounded-md border border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无可处理商品。</p>
      </aside>
    )
  }

  const readiness = readinessPct(item)
  return (
    <aside className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="flex items-start gap-3">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" style={{ border: '1px solid var(--color-border)' }} />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-muted)]">图</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{item.name}</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">{item.work_item_id}</p>
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-[var(--color-primary)]">查看货源</a>}
          </div>
          <Badge variant={item.status === 'ready' ? 'success' : item.status === 'blocked' ? 'danger' : 'warning'}>{item.lifecycle_label}</Badge>
        </div>
        <button onClick={() => onNavigate(buildObjectRoute(item.next_action_route, item))} className="mt-3 inline-flex items-center gap-1 rounded-md border border-[var(--color-primary)] px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
          {item.next_action}<ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <Panel title="Listing 与素材准备" icon={<FileText className="h-4 w-4" />}>
        <div className="flex items-center gap-3">
          <ReadinessRing value={readiness} />
          <div className="flex-1 space-y-1">
            <EvidenceLine label="趋势证据" value={item.evidence_completeness.trend} />
            <EvidenceLine label="社媒/文娱信号" value={item.evidence_completeness.social} />
            <EvidenceLine label="标题/卖点/属性" value={item.evidence_completeness.content} />
            <EvidenceLine label="图片/视频素材" value={item.evidence_completeness.content} />
          </div>
        </div>
      </Panel>

      <Panel title="平台校验" icon={<ShieldCheck className="h-4 w-4" />}>
        <InfoLine label="目标平台" value={item.platform || '待选择 Shopee / TEMU / TikTok Shop'} />
        <InfoLine label="目标市场" value={item.market || '待选择东南亚市场'} />
        <CheckLine label="平台销量/竞品证据" ok={item.evidence_completeness.platform === 'present' || item.evidence_completeness.competitor === 'present'} />
        <CheckLine label="发布风险排查" ok={item.evidence_completeness.risk === 'present'} />
        <CheckLine label="当前无阻塞缺口" ok={item.gaps.length === 0 && item.status !== 'blocked'} />
      </Panel>

      <Panel title="利润与定价" icon={<DollarSign className="h-4 w-4" />}>
        <InfoLine label="利润测算" value={evidenceText(item.evidence_completeness.profit)} />
        <InfoLine label="定价状态" value={item.stage_key === 'pricing' || item.lifecycle_status === 'price_confirmed' ? item.lifecycle_label : '等待进入定价校验'} />
        <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">未取得成本、售价、佣金或汇率证据时不展示虚拟利润。</p>
      </Panel>

      <Panel title="库存与货源" icon={<Truck className="h-4 w-4" />}>
        <InfoLine label="供应证据" value={evidenceText(item.evidence_completeness.supply)} />
        <InfoLine label="业务来源" value={item.source || '来源待补'} />
        <InfoLine label="负责人" value={item.assigned_to || '未分配'} />
      </Panel>

      <Panel title="来源记录" icon={<Box className="h-4 w-4" />}>
        {item.source_refs.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">来源记录待补。</p>
        ) : item.source_refs.slice(0, 5).map((ref) => (
          <button key={`${ref.type}-${ref.id}`} onClick={() => ref.meta?.route && onNavigate(ref.meta.route)} className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-md bg-[var(--color-bg)] px-2 py-1.5 text-left text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)]">
            <span className="truncate">{ref.meta?.source_label || ref.type} · {ref.label || ref.id}</span>
            {ref.meta?.route && <ExternalLink className="h-3 w-3 shrink-0" />}
          </button>
        ))}
      </Panel>

      <Panel title="下一步动作" icon={<CircleAlert className="h-4 w-4" />}>
        {actions.slice(0, 4).map((action, index) => (
          <button key={`${action.stage_key}-${action.work_item_id || index}`} onClick={() => onNavigate(buildObjectRoute(action.route, action, item))} className={`mb-1.5 block w-full rounded-md px-2 py-1.5 text-left text-xs ${action.primary ? 'border border-[var(--color-primary)] text-[var(--color-primary)]' : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-primary)]'}`}>
            {action.stage_label} · {labelBusinessCode(action.reason)}
          </button>
        ))}
      </Panel>
      <Panel title="任务协作与复盘" icon={<FileText className="h-4 w-4" />}>
        {!item.task_id ? (
          <p className="text-xs text-[var(--color-muted)]">先在表格中分配、关注或标记状态后生成任务记录。</p>
        ) : (
          <div className="space-y-2">
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="补充处理备注、外部沟通或证据说明" className="min-h-16 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" />
            <button disabled={saving || !comment.trim()} onClick={submitComment} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-40">提交备注</button>
            <div className="border-t border-[var(--color-border)] pt-2">
              <textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="完成复盘：实际结果、是否解决阻塞" className="min-h-16 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" />
              <input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="后续动作，可选" className="mt-1 h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" />
              <label className="mt-1 flex items-center justify-between text-xs text-[var(--color-muted)]">
                效果评分
                <select value={impactScore} onChange={(event) => setImpactScore(Number(event.target.value))} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[var(--color-fg)]">
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <button disabled={saving || !outcome.trim()} onClick={completeReview} className="mt-2 rounded-md border border-[var(--color-primary)] px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-40">完成并写复盘</button>
            </div>
            <div className="space-y-1">
              {events.slice(0, 4).map((event) => (
                <p key={event.id} className="rounded-md bg-[var(--color-bg)] px-2 py-1.5 text-[11px] text-[var(--color-muted)]">
                  {eventText(event.action)} · {event.detail || event.username}
                </p>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </aside>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">{icon}{title}</p>
      {children}
    </section>
  )
}

function ReadinessRing({ value }: { value: number }) {
  const color = value >= 80 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[6px] text-sm font-semibold" style={{ borderColor: color, color }}>
      {value}%
    </div>
  )
}

function EvidenceLine({ label, value }: { label: string; value: BusinessFlowBusItem['evidence_completeness'][keyof BusinessFlowBusItem['evidence_completeness']] }) {
  const present = value === 'present'
  return (
    <p className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={present ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>{evidenceText(value)}</span>
    </p>
  )
}

function CheckLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <p className="mb-1 flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={ok ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}>{ok ? '已通过' : '待补证据'}</span>
    </p>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <p className="mb-1 flex justify-between gap-2 text-xs"><span className="text-[var(--color-muted)]">{label}</span><span className="text-right text-[var(--color-fg)]">{value}</span></p>
}

function readinessPct(item: BusinessFlowBusItem) {
  return Math.round((item.evidence_summary.present / Math.max(item.evidence_summary.total, 1)) * 100)
}

function evidenceText(value: BusinessFlowBusItem['evidence_completeness'][keyof BusinessFlowBusItem['evidence_completeness']]) {
  if (value === 'present') return '已具备'
  if (value === 'stale') return '需刷新'
  if (value === 'low_confidence') return '低置信'
  return '待补证据'
}

function eventText(action: string) {
  if (action === 'business_flow_task_comment') return '处理备注'
  if (action === 'business_flow_task_completed_review') return '完成复盘'
  if (action.startsWith('business_flow_task_')) return '任务变更'
  return action
}
