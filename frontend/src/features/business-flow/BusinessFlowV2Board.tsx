import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckSquare, Download, Package, RefreshCw, Search } from 'lucide-react'
import { getBusinessFlowAssignees, updateBusinessFlowTasks } from '../../api/businessFlow'
import { Badge } from '../../components/ui/Badge'
import type { BusinessFlowAssignee, BusinessFlowBusItem, BusinessFlowItem, BusinessFlowOverview, BusinessFlowPipelineLane, BusinessFlowStageHealth, BusinessFlowTaskBulkRequest } from '../../types/businessFlow'
import { labelBusinessCode } from '../../utils/businessLabels'
import { logger } from '../../utils/logger'
import { productImageSrc } from '../../utils/productImages'
import { BusinessFlowContextRail } from './BusinessFlowContextRail'
import { buildObjectRoute } from './businessFlowRoutes'

interface Props {
  data: BusinessFlowOverview
  selectedStage: string
  currentUsername: string | null
  onStageFocus: (stageKey: string) => void
  onNavigate: (route: string) => void
  onReload: () => Promise<void>
}

type Scope = 'all' | 'assigned' | 'followed' | 'exceptions' | 'done'

export function BusinessFlowV2Board({ data, selectedStage, currentUsername, onStageFocus, onNavigate, onReload }: Props) {
  const [scope, setScope] = useState<Scope>('all')
  const [query, setQuery] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [activeItemKey, setActiveItemKey] = useState(data.current_context?.work_item_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignees, setAssignees] = useState<BusinessFlowAssignee[]>([])

  useEffect(() => {
    getBusinessFlowAssignees()
      .then((response) => setAssignees(response.data || []))
      .catch((e: any) => {
        logger.error('业务任务可分配成员加载失败', e)
        setAssignees(currentUsername ? [{ id: currentUsername, username: currentUsername, display_name: currentUsername, is_current: true }] : [])
      })
  }, [currentUsername])

  const filtered = useMemo(() => data.items.filter((item) => {
    const stageOk = !selectedStage || item.stage_key === selectedStage
    const text = `${item.name} ${item.source} ${item.platform || ''} ${item.market || ''} ${item.lifecycle_label}`.toLowerCase()
    const queryOk = !query.trim() || text.includes(query.trim().toLowerCase())
    const scopeOk = scope === 'all'
      || (scope === 'assigned' && item.assigned_to === currentUsername)
      || (scope === 'followed' && item.is_followed)
      || (scope === 'exceptions' && item.status === 'blocked')
      || (scope === 'done' && item.task_status === 'done')
    return stageOk && queryOk && scopeOk
  }), [currentUsername, data.items, query, scope, selectedStage])

  const selectedItems = useMemo(() => {
    const selected = new Set(selectedKeys)
    return filtered.filter((item) => selected.has(itemKey(item)))
  }, [filtered, selectedKeys])
  const activeItem = filtered.find((item) => item.work_item_id === activeItemKey)
    || data.items.find((item) => item.work_item_id === activeItemKey)
    || data.current_context
    || filtered[0]
    || null

  const toggle = (item: BusinessFlowItem) => {
    const key = itemKey(item)
    setSelectedKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])
    setActiveItemKey(item.work_item_id)
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

  const exportQueue = () => {
    if (filtered.length === 0) return
    const rows = [['商品/候选', '阶段', '状态', '来源', '平台', '市场', '负责人', '下一动作', '缺口'], ...filtered.map((item) => [
      item.name, item.stage_name, item.lifecycle_label, item.source, item.platform || '', item.market || '', item.assigned_to || '', item.next_action, item.gaps.join('；'),
    ])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'business-flow.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 space-y-3">
        <StageRibbon stages={data.stage_health} selectedStage={selectedStage} onStageFocus={onStageFocus} />
        <FlowStageSwimlanes lanes={data.product_pipeline} activeKey={activeItem?.work_item_id || ''} onPick={setActiveItemKey} onNavigate={onNavigate} />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-3">
            <ScopeButton active={scope === 'all'} onClick={() => setScope('all')}>全部 ({data.metrics.item_count})</ScopeButton>
            <ScopeButton active={scope === 'assigned'} onClick={() => setScope('assigned')}>我负责 ({data.metrics.assigned_to_me})</ScopeButton>
            <ScopeButton active={scope === 'followed'} onClick={() => setScope('followed')}>我关注 ({data.metrics.followed})</ScopeButton>
            <ScopeButton active={scope === 'exceptions'} onClick={() => setScope('exceptions')}>异常 ({data.metrics.exceptions})</ScopeButton>
            <ScopeButton active={scope === 'done'} onClick={() => setScope('done')}>已完成</ScopeButton>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2">
                <Search className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索商品/SKU/平台/状态" className="w-48 bg-transparent text-xs text-[var(--color-fg)] outline-none" />
              </label>
              <button onClick={exportQueue} disabled={filtered.length === 0} className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40">
                <Download className="h-3.5 w-3.5" />导出
              </button>
              <button onClick={onReload} className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
                <RefreshCw className="h-3.5 w-3.5" />刷新
              </button>
            </div>
          </div>
          <BulkToolbar saving={saving} count={selectedItems.length} currentUsername={currentUsername} assignees={assignees} onAction={bulkAction} />
          {error && <p className="mx-3 mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
          <FlowTable items={filtered} selectedKeys={selectedKeys} activeKey={activeItem?.work_item_id || ''} onToggle={toggle} onPick={setActiveItemKey} onNavigate={onNavigate} />
        </div>
      </section>
      <BusinessFlowContextRail item={activeItem} actions={data.next_actions} onNavigate={onNavigate} onReload={onReload} />
    </div>
  )
}

function FlowStageSwimlanes({ lanes, activeKey, onPick, onNavigate }: {
  lanes: BusinessFlowPipelineLane[]
  activeKey: string
  onPick: (key: string) => void
  onNavigate: (route: string) => void
}) {
  const visible = lanes.slice(0, 6)
  return (
    <section aria-label="阶段泳道" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">商品泳道</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">按阶段横向观察商品处理密度，点击任一对象可锁定右侧上下文。</p>
        </div>
        <Badge variant="outline">阶段泳道 {visible.length}</Badge>
      </div>
      <div className="grid gap-2 xl:grid-cols-6">
        {visible.map((lane) => (
          <div key={lane.stage_key} className="min-h-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[var(--color-fg)]">{lane.label}</span>
                <span className="block text-[11px] text-[var(--color-muted)]">{lane.object_count} 个对象</span>
              </span>
              <Badge variant={lane.blocked_count > 0 ? 'danger' : lane.data_required_count > 0 ? 'warning' : 'success'}>
                {lane.blocked_count > 0 ? `阻塞 ${lane.blocked_count}` : lane.data_required_count > 0 ? `待补 ${lane.data_required_count}` : '顺畅'}
              </Badge>
            </div>
            <div className="space-y-1.5">
              {lane.items.slice(0, 3).map((item) => (
                <SwimlaneItem key={`${item.type}-${item.id}`} item={item} active={item.work_item_id === activeKey} onPick={onPick} onNavigate={onNavigate} />
              ))}
              {lane.items.length === 0 && (
                <p className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-3 text-center text-[11px] text-[var(--color-muted)]">等待真实对象进入</p>
              )}
              {lane.items.length > 3 && <p className="text-[11px] text-[var(--color-muted)]">另有 {lane.items.length - 3} 个对象在表格中处理</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SwimlaneItem({ item, active, onPick, onNavigate }: {
  item: BusinessFlowBusItem
  active: boolean
  onPick: (key: string) => void
  onNavigate: (route: string) => void
}) {
  const blocked = item.status === 'blocked' || item.gaps.length > 0
  return (
    <button onClick={() => onPick(item.work_item_id)} className={`w-full rounded-md border p-2 text-left transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <span className="flex items-center gap-2">
        {item.image_url ? (
          <img src={productImageSrc(item.image_url)} alt={item.name} className="h-8 w-8 shrink-0 rounded object-cover" style={{ border: '1px solid var(--color-border)' }} />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded border border-[var(--color-border)] text-[var(--color-muted)]"><Package className="h-4 w-4" /></span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-[var(--color-fg)]">{item.name}</span>
          <span className={blocked ? 'block truncate text-[10px] text-[var(--color-warning)]' : 'block truncate text-[10px] text-[var(--color-muted)]'}>
            {blocked ? labelBusinessCode(item.gaps[0] || item.lifecycle_label) : item.lifecycle_label}
          </span>
        </span>
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--color-muted)]">
        <span>{item.platform || item.source} · {item.market || '市场待补'}</span>
        <span onClick={(event) => { event.stopPropagation(); onNavigate(buildObjectRoute(item.next_action_route, item)) }} className="text-[var(--color-primary)]">处理</span>
      </span>
    </button>
  )
}

function StageRibbon({ stages, selectedStage, onStageFocus }: { stages: BusinessFlowStageHealth[]; selectedStage: string; onStageFocus: (stageKey: string) => void }) {
  const totalObjects = stages.reduce((sum, stage) => sum + stage.object_count, 0)
  const totalGaps = stages.reduce((sum, stage) => sum + stage.data_required_count + stage.blocked_count, 0)
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">业务处理总线</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">信号捕获 → 候选验证 → 选品决策 → 内容制作 → 定价校验 → 平台刊登</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">对象 {totalObjects}</Badge>
          <Badge variant={totalGaps > 0 ? 'warning' : 'success'}>缺口 {totalGaps}</Badge>
        </div>
      </div>
      <div aria-label="业务处理阶段" className="grid gap-2 lg:grid-cols-6">
        {stages.map((stage, index) => {
          const active = selectedStage === stage.stage_key
          return (
            <button key={stage.stage_key} onClick={() => onStageFocus(stage.stage_key)} className={`relative rounded-lg border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)] ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-bg)]'}`}>
              {index < stages.length - 1 && <span className="pointer-events-none absolute left-[calc(100%-4px)] top-5 hidden h-px w-4 bg-[var(--color-border)] lg:block" />}
              <div className="flex items-center gap-2">
                <StageDot index={index} status={stage.status} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--color-fg)]">{stage.label}</span>
                  <span className="block text-[11px] text-[var(--color-muted)]">{stage.object_count} 个对象 · {stage.health_pct}%</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, stage.health_pct))}%`, background: stage.status === 'ready' ? 'var(--color-success)' : stage.status === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
              </div>
              <p className={stage.data_required_count + stage.blocked_count > 0 ? 'mt-1.5 text-[11px] text-[var(--color-warning)]' : 'mt-1.5 text-[11px] text-[var(--color-muted)]'}>
                {stage.data_required_count + stage.blocked_count > 0 ? `待补 ${stage.data_required_count + stage.blocked_count}` : '可继续推进'}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FlowTable({ items, selectedKeys, activeKey, onToggle, onPick, onNavigate }: {
  items: BusinessFlowItem[]
  selectedKeys: string[]
  activeKey: string
  onToggle: (item: BusinessFlowItem) => void
  onPick: (key: string) => void
  onNavigate: (route: string) => void
}) {
  if (items.length === 0) return <EmptyTable onNavigate={onNavigate} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
            <th className="w-10 px-3 py-2 text-left"><CheckSquare className="h-3.5 w-3.5" /></th>
            <th className="px-2 py-2 text-left">产品信息</th>
            <th className="px-2 py-2 text-left">当前阶段</th>
            <th className="px-2 py-2 text-left">数据缺口</th>
            <th className="px-2 py-2 text-left">来源平台</th>
            <th className="px-2 py-2 text-left">负责人</th>
            <th className="px-2 py-2 text-left">下一步动作</th>
            <th className="px-3 py-2 text-left">资料完整度</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={itemKey(item)} onClick={() => onPick(item.work_item_id)} className={`border-b border-[var(--color-border)] transition hover:bg-[var(--color-primary-light)] ${activeKey === item.work_item_id ? 'bg-[var(--color-primary-light)]' : ''}`}>
              <td className="px-3 py-3"><input type="checkbox" checked={selectedKeys.includes(itemKey(item))} onChange={() => onToggle(item)} onClick={(event) => event.stopPropagation()} /></td>
              <td className="max-w-[280px] px-2 py-3">
                <div className="flex items-center gap-3">
                  {item.image_url ? (
                    <img src={productImageSrc(item.image_url)} alt={item.name} className="h-12 w-12 shrink-0 rounded-md object-cover" style={{ border: '1px solid var(--color-border)' }} />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)]"><Package className="h-5 w-5" /></span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--color-fg)]">{item.name}</span>
                    <span className="mt-1 block truncate text-[11px] text-[var(--color-muted)]">{item.source_url || item.work_item_id}</span>
                  </span>
                </div>
              </td>
              <td className="px-2 py-3"><StageBadge item={item} /></td>
              <td className="max-w-[220px] px-2 py-3 text-[var(--color-warning)]">{item.gaps[0] ? labelBusinessCode(item.gaps[0]) : '无阻塞缺口'}</td>
              <td className="px-2 py-3">
                <p className="text-[var(--color-fg)]">{item.platform || item.source}</p>
                <p className="text-[11px] text-[var(--color-muted)]">{item.account_name || '店铺待定位'} · {item.market || '市场待补'}</p>
              </td>
              <td className="px-2 py-3"><p className="text-[var(--color-fg)]">{item.assigned_to || '未分配'}</p><p className="text-[11px] text-[var(--color-muted)]">{taskStatusText(item.task_status)}</p></td>
              <td className="px-2 py-3"><button onClick={(event) => { event.stopPropagation(); onNavigate(buildObjectRoute(item.next_action_route, item)) }} className="inline-flex items-center gap-1 text-[var(--color-primary)]">{item.next_action}<ArrowRight className="h-3 w-3" /></button></td>
              <td className="px-3 py-3"><Badge variant={item.evidence_summary.missing > 0 ? 'warning' : 'success'}>{item.evidence_summary.present}/{item.evidence_summary.total}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BulkToolbar({ count, saving, currentUsername, assignees, onAction }: {
  count: number
  saving: boolean
  currentUsername: string | null
  assignees: BusinessFlowAssignee[]
  onAction: (payload: Omit<BusinessFlowTaskBulkRequest, 'items'>) => void
}) {
  const [assignee, setAssignee] = useState(currentUsername || '')
  useEffect(() => { setAssignee((current) => current || currentUsername || assignees[0]?.username || '') }, [assignees, currentUsername])
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <span className="text-xs text-[var(--color-muted)]">已选 {count} 条</span>
      {currentUsername && <TaskButton disabled={saving || count === 0} onClick={() => onAction({ action: 'assign', assigned_to: currentUsername })}>分配给我</TaskButton>}
      {assignees.length > 0 && (
        <label className="flex h-8 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)]">
          分配给
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} className="bg-transparent text-[var(--color-fg)] outline-none">
            {assignees.map((item) => <option key={item.id} value={item.username}>{item.display_name}</option>)}
          </select>
          <button disabled={saving || count === 0 || !assignee} onClick={() => onAction({ action: 'assign', assigned_to: assignee })} className="text-[var(--color-primary)] disabled:opacity-40">确认</button>
        </label>
      )}
      <TaskButton disabled={saving || count === 0} onClick={() => onAction({ action: 'follow' })}>关注</TaskButton>
      <TaskButton disabled={saving || count === 0} onClick={() => onAction({ action: 'set_status', status: 'processing' })}>处理中</TaskButton>
      <TaskButton disabled={saving || count === 0} onClick={() => onAction({ action: 'set_status', status: 'done' })}>完成</TaskButton>
      <TaskButton disabled={saving || count === 0} onClick={() => onAction({ action: 'set_priority', priority: 'high' })}>高优</TaskButton>
    </div>
  )
}

function EmptyTable({ onNavigate }: { onNavigate: (route: string) => void }) {
  return <EmptyFlowState onNavigate={onNavigate} />
}

function EmptyFlowState({ onNavigate }: { onNavigate: (route: string) => void }) {
  const steps = ['信号捕获', '候选验证', '选品决策', '内容制作', '定价校验', '平台刊登']
  const actions = [
    { label: '进入品源与选品', route: '/scout', detail: '从四层信号补充候选商品' },
    { label: '补充真实业务对象', route: '/products', detail: '导入商品主数据、图片和平台属性' },
    { label: '连接平台店铺', route: '/platforms', detail: '接入 Shopee、TEMU、TikTok Shop 店铺' },
  ]
  return (
    <section aria-label="业务链路空状态" className="p-6">
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[var(--color-fg)]">业务链路空状态</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              当前筛选下没有真实业务对象。请先补充选品候选、商品主数据或平台店铺数据，系统才会形成从选品到刊登的可追踪处理总线。
            </p>
          </div>
          <Badge variant="warning">不使用 mock 数据填充</Badge>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-6">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">{index + 1}</span>
              <p className="mt-2 text-xs font-semibold text-[var(--color-fg)]">{step}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">等待真实对象进入</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-3">
          {actions.map((action) => (
            <button key={action.route} onClick={() => onNavigate(action.route)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
              <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--color-primary)]">
                {action.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="mt-1 block text-[11px] text-[var(--color-muted)]">{action.detail}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function StageDot({ index, status }: { index: number; status: BusinessFlowStageHealth['status'] }) {
  const color = status === 'ready' ? 'var(--color-success)' : status === 'blocked' ? 'var(--color-danger)' : 'var(--color-warning)'
  return <span className="grid h-7 w-7 place-items-center rounded-full border text-[11px]" style={{ borderColor: color, color }}>{index + 1}</span>
}

function StageBadge({ item }: { item: BusinessFlowItem }) {
  const variant = item.status === 'ready' ? 'success' : item.status === 'blocked' ? 'danger' : 'warning'
  return <div className="space-y-1"><Badge variant={variant}>{item.stage_name}</Badge><p className="text-[11px] text-[var(--color-muted)]">{item.lifecycle_label}</p></div>
}

function ScopeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-md border px-3 py-1.5 text-xs transition ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-fg)]'}`}>{children}</button>
}

function TaskButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button disabled={disabled} onClick={onClick} className="h-8 rounded-md border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40">{children}</button>
}

function toTaskRef(item: BusinessFlowItem) {
  return { item_type: item.type, item_id: item.id, stage_key: item.stage_key, title: item.name, route: buildObjectRoute(item.next_action_route, item), source_refs: item.source_refs, last_gap: item.gaps[0] || null }
}

function itemKey(item: BusinessFlowItem) {
  return `${item.type}-${item.id}`
}

function taskStatusText(status: BusinessFlowItem['task_status']) {
  if (status === 'processing') return '处理中'
  if (status === 'done') return '已完成'
  if (status === 'cancelled') return '已取消'
  return '待处理'
}
