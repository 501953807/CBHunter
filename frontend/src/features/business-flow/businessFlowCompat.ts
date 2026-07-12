import type {
  BusinessFlowBusItem,
  BusinessFlowNextAction,
  BusinessFlowOverview,
  BusinessFlowPipelineLane,
  BusinessFlowStage,
  BusinessFlowStageHealth,
} from '../../types/businessFlow'

const evidenceKeys = ['trend', 'social', 'platform', 'supply', 'profit', 'competitor', 'content', 'risk'] as const

export function normalizeBusinessFlowOverview(input: BusinessFlowOverview | null): BusinessFlowOverview | null {
  if (!input) return null
  const raw = input as any
  const stages = (Array.isArray(raw.stages) ? raw.stages : []).map(normalizeStage)
  const items = (Array.isArray(raw.items) ? raw.items : []).map(normalizeItem)
  const stageHealth = Array.isArray(raw.stage_health) ? raw.stage_health : buildStageHealth(stages, items)
  const productPipeline = Array.isArray(raw.product_pipeline) ? raw.product_pipeline : buildPipeline(stages, items)
  const pendingQueue = Array.isArray(raw.pending_queue) ? raw.pending_queue.map(normalizeItem) : items.filter((item: BusinessFlowBusItem) => item.status !== 'ready')
  const currentContext = raw.current_context ? normalizeItem(raw.current_context) : pendingQueue[0] || productPipeline.find((lane: BusinessFlowPipelineLane) => lane.items.length > 0)?.items[0] || null
  return {
    ...raw,
    generated_at: raw.generated_at || new Date().toISOString(),
    current_username: raw.current_username ?? null,
    stages,
    items,
    stage_health: stageHealth,
    product_pipeline: productPipeline,
    pending_queue: pendingQueue,
    current_context: currentContext,
    next_actions: Array.isArray(raw.next_actions) ? raw.next_actions : buildNextActions(currentContext, pendingQueue, stages),
    metrics: {
      stage_count: stages.length,
      blocked: stages.filter((stage: BusinessFlowStage) => stage.status === 'blocked').length,
      data_required: stages.filter((stage: BusinessFlowStage) => stage.status === 'data_required').length,
      source_count: 0,
      item_count: items.length,
      item_blocked: items.filter((item: BusinessFlowBusItem) => item.status === 'blocked').length,
      item_data_required: items.filter((item: BusinessFlowBusItem) => item.status === 'data_required').length,
      task_count: 0,
      assigned_to_me: 0,
      followed: 0,
      exceptions: items.filter((item: BusinessFlowBusItem) => item.status === 'blocked').length,
      ...(raw.metrics || {}),
    },
    source_refs: Array.isArray(raw.source_refs) ? raw.source_refs : [],
    gaps: Array.isArray(raw.gaps) ? raw.gaps : Array.isArray(raw.data_gaps) ? raw.data_gaps : [],
  }
}

function normalizeStage(stage: Partial<BusinessFlowStage> & { data_gaps?: string[] }): BusinessFlowStage {
  const gaps = Array.isArray(stage.gaps) ? stage.gaps : Array.isArray(stage.data_gaps) ? stage.data_gaps : []
  return {
    key: stage.key || 'unknown',
    name: stage.name || '未命名阶段',
    route: stage.route || '/',
    next_action_route: stage.next_action_route || stage.route || '/',
    source: stage.source || '来源待补',
    status: stage.status || 'data_required',
    signal: stage.signal || '信号待补',
    gaps,
    next_action: stage.next_action || '前往处理',
    source_refs: Array.isArray(stage.source_refs) ? stage.source_refs : [],
    evidence_window: stage.evidence_window || '证据窗口待补',
  }
}

function normalizeItem(item: any): BusinessFlowBusItem {
  const gaps = Array.isArray(item.gaps) ? item.gaps : Array.isArray(item.data_gaps) ? item.data_gaps : []
  const status = item.status || (gaps.length > 0 ? 'data_required' : 'ready')
  const evidenceSummary = item.evidence_summary || { total: 8, present: item.source_refs?.length ? 1 : 0, missing: item.source_refs?.length ? 7 : 8, stale: 0, low_confidence: 0 }
  return {
    ...item,
    id: item.id || 'unknown',
    type: item.type || 'business_item',
    name: item.name || item.title || '未命名商品对象',
    work_item_id: item.work_item_id || `${item.type || 'business_item'}:${item.id || 'unknown'}`,
    object_refs: Array.isArray(item.object_refs) ? item.object_refs : [{ type: item.type || 'business_item', id: item.id || 'unknown', label: item.name || item.title || '未命名商品对象' }],
    lifecycle_status: item.lifecycle_status || (status === 'blocked' ? 'blocked' : status === 'ready' ? 'decision_passed' : 'candidate_validating'),
    lifecycle_label: item.lifecycle_label || (status === 'blocked' ? '流程阻塞' : status === 'ready' ? '可推进' : '待补证据'),
    evidence_completeness: item.evidence_completeness || Object.fromEntries(evidenceKeys.map((key) => [key, key === 'risk' && item.source_refs?.length ? 'present' : 'missing'])),
    evidence_summary: evidenceSummary,
    stage_key: item.stage_key || 'selection',
    stage_name: item.stage_name || item.stage_key || '选品',
    status,
    route: item.route || item.next_action_route || '/',
    next_action_route: item.next_action_route || item.route || '/',
    source: item.source || '来源待补',
    signal: item.signal || item.source || '信号待补',
    next_action: item.next_action || '前往处理',
    gaps,
    source_refs: Array.isArray(item.source_refs) ? item.source_refs : [],
    platform: item.platform ?? null,
    market: item.market ?? null,
    task_id: item.task_id ?? null,
    task_status: item.task_status ?? null,
    assigned_to: item.assigned_to ?? null,
    is_followed: Boolean(item.is_followed),
    priority: item.priority ?? null,
  }
}

function buildStageHealth(stages: BusinessFlowStage[], items: BusinessFlowBusItem[]): BusinessFlowStageHealth[] {
  return stages.map((stage) => {
    const stageItems = items.filter((item) => item.stage_key === stage.key)
    return {
      stage_key: stage.key,
      label: stage.name,
      status: stage.status,
      object_count: stageItems.length,
      blocked_count: stageItems.filter((item) => item.status === 'blocked').length,
      data_required_count: stageItems.filter((item) => item.status === 'data_required').length,
      ready_count: stageItems.filter((item) => item.status === 'ready').length,
      health_pct: stageItems.length ? Math.round((stageItems.filter((item) => item.status === 'ready').length / stageItems.length) * 100) : 0,
      route: stage.route,
      next_action_route: stage.next_action_route,
      next_action: stage.next_action,
      data_gaps: stage.gaps,
      source_refs: stage.source_refs,
    }
  })
}

function buildPipeline(stages: BusinessFlowStage[], items: BusinessFlowBusItem[]): BusinessFlowPipelineLane[] {
  return stages.map((stage) => {
    const laneItems = items.filter((item) => item.stage_key === stage.key)
    return {
      stage_key: stage.key,
      label: stage.name,
      status: stage.status,
      object_count: laneItems.length,
      blocked_count: laneItems.filter((item) => item.status === 'blocked').length,
      data_required_count: laneItems.filter((item) => item.status === 'data_required').length,
      route: stage.route,
      items: laneItems,
    }
  })
}

function buildNextActions(current: BusinessFlowBusItem | null, pending: BusinessFlowBusItem[], stages: BusinessFlowStage[]): BusinessFlowNextAction[] {
  const actions = pending.slice(0, 5).map((item, index) => ({
    type: 'work_item' as const,
    label: item.next_action,
    route: item.next_action_route,
    stage_key: item.stage_key,
    stage_label: item.stage_name,
    reason: item.gaps[0] || item.signal,
    primary: current?.work_item_id === item.work_item_id || index === 0,
    work_item_id: item.work_item_id,
    object_refs: item.object_refs,
  }))
  if (actions.length > 0) return actions
  return stages.filter((stage) => stage.gaps.length > 0).slice(0, 5).map((stage) => ({
    type: 'stage' as const,
    label: stage.next_action,
    route: stage.next_action_route,
    stage_key: stage.key,
    stage_label: stage.name,
    reason: stage.gaps[0],
    primary: false,
    work_item_id: null,
  }))
}
