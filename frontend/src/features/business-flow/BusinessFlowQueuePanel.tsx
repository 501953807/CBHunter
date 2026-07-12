import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Download, Search, UsersRound } from 'lucide-react'
import { updateBusinessFlowTasks } from '../../api/businessFlow'
import { Badge } from '../../components/ui/Badge'
import type { BusinessFlowItem, BusinessFlowStage, BusinessFlowTaskBulkRequest } from '../../types/businessFlow'
import { logger } from '../../utils/logger'
import { buildObjectRoute } from './businessFlowRoutes'

interface Props {
  items: BusinessFlowItem[]
  stages: BusinessFlowStage[]
  currentUsername: string | null
  onStageFocus: (stageKey: string) => void
  onNavigate: (route: string) => void
  onReload: () => Promise<void>
}

type ViewFilter = 'all' | 'assigned' | 'followed' | 'exceptions'

export function BusinessFlowQueuePanel({ items, stages, currentUsername, onStageFocus, onNavigate, onReload }: Props) {
  const [stageFilter, setStageFilter] = useState('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [assignee, setAssignee] = useState(currentUsername || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredItems = useMemo(() => items.filter((item) => {
    const stageMatches = stageFilter === 'all' || item.stage_key === stageFilter
    const text = `${item.name} ${item.source} ${item.platform || ''} ${item.market || ''}`.toLowerCase()
    const textMatches = !query.trim() || text.includes(query.trim().toLowerCase())
    const viewMatches = viewFilter === 'all'
      || (viewFilter === 'assigned' && item.assigned_to === currentUsername)
      || (viewFilter === 'followed' && item.is_followed)
      || (viewFilter === 'exceptions' && item.status === 'blocked')
    return stageMatches && textMatches && viewMatches
  }), [currentUsername, items, query, stageFilter, viewFilter])

  const selectedItems = useMemo(() => {
    const selected = new Set(selectedKeys)
    return filteredItems.filter((item) => selected.has(itemKey(item)))
  }, [filteredItems, selectedKeys])

  const toggle = (item: BusinessFlowItem) => {
    const key = itemKey(item)
    setSelectedKeys((current) => current.includes(key) ? current.filter((itemKeyValue) => itemKeyValue !== key) : [...current, key])
  }

  const exportQueue = () => {
    if (filteredItems.length === 0) return
    const rows = [['商品/候选', '生命周期', '阶段', '负责人', '任务状态', '来源', '平台', '市场', '信号', '证据完整度', '缺口'], ...filteredItems.map((item) => [
      item.name, item.lifecycle_label, item.stage_name, item.assigned_to || '', item.task_status || '', item.source, item.platform || '', item.market || '', item.signal, `${item.evidence_summary.present}/${item.evidence_summary.total}`, item.gaps.join('；'),
    ])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'business-flow.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const bulkAction = async (payload: Omit<BusinessFlowTaskBulkRequest, 'items'>) => {
    if (selectedItems.length === 0) return
    setSaving(true)
    setError('')
    try {
      await updateBusinessFlowTasks({ ...payload, items: selectedItems.map(toTaskRef) })
      setSelectedKeys([])
      await onReload()
    } catch (e: any) {
      logger.error('业务监控台批量任务更新失败', e)
      setError(e?.response?.data?.detail || e?.message || '批量更新失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        <UsersRound className="h-4 w-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-fg)]">商品推进队列</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2">
            <Search className="h-3.5 w-3.5 text-[var(--color-muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品、来源或平台" className="w-40 bg-transparent text-xs text-[var(--color-fg)] outline-none" />
          </label>
          <button
            onClick={exportQueue}
            disabled={filteredItems.length === 0}
            title={filteredItems.length === 0 ? '当前筛选下暂无可导出记录' : '导出当前筛选结果'}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />导出
          </button>
          {filteredItems.length === 0 && <span className="text-[11px] text-[var(--color-muted)]">无数据不可导出</span>}
          <Badge variant="outline">{filteredItems.length}</Badge>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setViewFilter('all')} className={filterButtonClass(viewFilter === 'all')}>全部</button>
        <button onClick={() => setViewFilter('assigned')} className={filterButtonClass(viewFilter === 'assigned')}>我的任务</button>
        <button onClick={() => setViewFilter('followed')} className={filterButtonClass(viewFilter === 'followed')}>我关注</button>
        <button onClick={() => setViewFilter('exceptions')} className={filterButtonClass(viewFilter === 'exceptions')}>异常</button>
        <span className="mx-1 h-6 border-l border-[var(--color-border)]" />
        <button onClick={() => setStageFilter('all')} className={filterButtonClass(stageFilter === 'all')}>全部阶段</button>
        {stages.map((stage) => (
          <button key={stage.key} onClick={() => {
            setStageFilter(stage.key)
            onStageFocus(stage.key)
          }} className={filterButtonClass(stageFilter === stage.key)}>{stage.name}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
        <span className="text-xs text-[var(--color-muted)]">已选 {selectedItems.length} 条</span>
        <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="负责人用户名" className="h-8 w-32 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-fg)] outline-none focus:border-[var(--color-primary)]" />
        <TaskButton disabled={saving || selectedItems.length === 0 || !assignee.trim()} onClick={() => bulkAction({ action: 'assign', assigned_to: assignee.trim() })}>分配</TaskButton>
        {currentUsername && <TaskButton disabled={saving || selectedItems.length === 0} onClick={() => bulkAction({ action: 'assign', assigned_to: currentUsername })}>分配给我</TaskButton>}
        <TaskButton disabled={saving || selectedItems.length === 0} onClick={() => bulkAction({ action: 'follow' })}>关注</TaskButton>
        <TaskButton disabled={saving || selectedItems.length === 0} onClick={() => bulkAction({ action: 'set_status', status: 'processing' })}>处理中</TaskButton>
        <TaskButton disabled={saving || selectedItems.length === 0} onClick={() => bulkAction({ action: 'set_status', status: 'done' })}>完成</TaskButton>
        <TaskButton disabled={saving || selectedItems.length === 0} onClick={() => bulkAction({ action: 'set_priority', priority: 'high' })}>高优</TaskButton>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
              <th className="py-2 text-left">选择</th>
              <th className="py-2 text-left">商品/候选</th>
              <th className="py-2 text-left">业务状态</th>
              <th className="py-2 text-left">阶段</th>
              <th className="py-2 text-left">证据</th>
              <th className="py-2 text-left">责任</th>
              <th className="py-2 text-left">缺口</th>
              <th className="py-2 text-left">动作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? <EmptyRows onNavigate={onNavigate} /> : filteredItems.map((item) => (
              <tr key={itemKey(item)} className="border-b border-[var(--color-border)] transition hover:bg-[var(--color-primary-light)]" style={{ backgroundColor: item.status === 'blocked' ? 'var(--color-danger-light)' : item.status === 'data_required' ? 'var(--color-bg)' : undefined }}>
                <td className="py-3"><input type="checkbox" checked={selectedKeys.includes(itemKey(item))} onChange={() => toggle(item)} /></td>
                <td className="max-w-[260px] py-3">
                  <p className="truncate font-medium text-[var(--color-fg)]">{item.name}</p>
                  <p className="truncate text-[11px] text-[var(--color-muted)]">{item.work_item_id} · {item.source}{item.platform ? ` · ${item.platform}` : ''}{item.market ? ` · ${item.market}` : ''}</p>
                </td>
                <td className="py-3"><LifecycleBadge item={item} /></td>
                <td className="py-3"><StatusBadge status={item.status} label={item.stage_name} /></td>
                <td className="py-3"><EvidenceSummary item={item} /></td>
                <td className="py-3"><TaskState item={item} /></td>
                <td className="max-w-[260px] py-3" style={{ color: item.status === 'blocked' ? 'var(--color-danger)' : item.status === 'data_required' ? 'var(--color-muted)' : 'var(--color-success)' }}>{item.gaps[0] || '无阻塞缺口'}</td>
                <td className="py-3">
                  <button onClick={() => onNavigate(buildObjectRoute(item.next_action_route, item))} className="inline-flex items-center gap-1 text-[var(--color-primary)]">
                    {item.next_action} <ArrowRight className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TaskButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button disabled={disabled} onClick={onClick} className="h-8 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40">{children}</button>
}

function EmptyRows({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <tr><td colSpan={8} className="py-6 text-center text-[var(--color-muted)]">
      <p>当前筛选下暂无真实业务记录。</p>
      <div className="mt-3 flex justify-center gap-2">
        <button onClick={() => onNavigate('/scout')} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-primary)] hover:border-[var(--color-primary)]">进入选品</button>
        <button onClick={() => onNavigate('/products')} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-primary)] hover:border-[var(--color-primary)]">导入商品</button>
        <button onClick={() => onNavigate('/scout/sources')} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-primary)] hover:border-[var(--color-primary)]">进入品源管理</button>
      </div>
    </td></tr>
  )
}

function TaskState({ item }: { item: BusinessFlowItem }) {
  if (!item.task_id) return <span className="text-[var(--color-muted)]">未建任务</span>
  return (
    <div className="space-y-1">
      <p className="text-[var(--color-fg)]">{item.assigned_to || '未分配'}</p>
      <div className="flex flex-wrap gap-1">
        <Badge variant={item.task_status === 'done' ? 'success' : item.task_status === 'processing' ? 'info' : 'outline'}>{taskStatusText(item.task_status)}</Badge>
        {item.priority && <Badge variant={item.priority === 'urgent' || item.priority === 'high' ? 'warning' : 'outline'}>{priorityText(item.priority)}</Badge>}
        {item.is_followed && <Badge variant="info">关注</Badge>}
      </div>
    </div>
  )
}

function LifecycleBadge({ item }: { item: BusinessFlowItem }) {
  const warning = item.lifecycle_status === 'blocked'
    || item.lifecycle_status === 'decision_pending'
    || item.lifecycle_status === 'content_required'
    || item.lifecycle_status === 'pricing_required'
  return <Badge variant={warning ? 'warning' : item.lifecycle_status === 'published' ? 'success' : 'info'}>{item.lifecycle_label}</Badge>
}

function EvidenceSummary({ item }: { item: BusinessFlowItem }) {
  const { present, total, missing, low_confidence: lowConfidence } = item.evidence_summary
  return (
    <div className="space-y-1">
      <Badge variant={missing > 0 ? 'warning' : 'success'}>{present}/{total}</Badge>
      {lowConfidence > 0 && <p className="text-[11px] text-[var(--color-muted)]">低置信 {lowConfidence}</p>}
    </div>
  )
}

function StatusBadge({ status, label }: { status: BusinessFlowStage['status']; label: string }) {
  const suffix = status === 'ready' ? '可推进' : status === 'blocked' ? '阻塞' : '未开始'
  return <Badge variant={status === 'ready' ? 'success' : status === 'blocked' ? 'danger' : 'warning'}>{label} · {suffix}</Badge>
}

function toTaskRef(item: BusinessFlowItem) {
  return {
    item_type: item.type,
    item_id: item.id,
    stage_key: item.stage_key,
    title: item.name,
    route: buildObjectRoute(item.next_action_route, item),
    source_refs: item.source_refs,
    last_gap: item.gaps[0] || null,
  }
}

function itemKey(item: BusinessFlowItem) {
  return `${item.type}-${item.id}`
}

function filterButtonClass(active: boolean) {
  return `rounded-md border px-2 py-1 text-xs transition ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}`
}

function taskStatusText(status: BusinessFlowItem['task_status']) {
  if (status === 'processing') return '处理中'
  if (status === 'done') return '已完成'
  if (status === 'cancelled') return '已取消'
  return '待处理'
}

function priorityText(priority: NonNullable<BusinessFlowItem['priority']>) {
  if (priority === 'urgent') return '紧急'
  if (priority === 'high') return '高优'
  if (priority === 'low') return '低优'
  return '普通'
}
