import type { CockpitSourceRef } from './cockpit'

export interface BusinessFlowStage {
  key: string
  name: string
  route: string
  next_action_route: string
  source: string
  status: 'ready' | 'blocked' | 'data_required'
  signal: string
  gaps: string[]
  next_action: string
  source_refs: CockpitSourceRef[]
  evidence_window: string
}

export interface BusinessFlowItem {
  id: string
  type: string
  name: string
  work_item_id: string
  object_refs: Array<{ type: string; id: string; label: string }>
  lifecycle_status: 'signal_captured' | 'candidate_validating' | 'decision_pending' | 'decision_passed' | 'content_required' | 'content_ready' | 'pricing_required' | 'price_confirmed' | 'listing_ready' | 'draft_created' | 'published' | 'blocked' | 'archived'
  lifecycle_label: string
  evidence_completeness: Record<'trend' | 'social' | 'platform' | 'supply' | 'profit' | 'competitor' | 'content' | 'risk', 'present' | 'missing' | 'stale' | 'low_confidence'>
  evidence_summary: {
    total: number
    present: number
    missing: number
    stale: number
    low_confidence: number
  }
  stage_key: string
  stage_name: string
  status: 'ready' | 'blocked' | 'data_required'
  route: string
  next_action_route: string
  source: string
  signal: string
  next_action: string
  gaps: string[]
  source_refs: CockpitSourceRef[]
  evidence_window: string
  platform: string | null
  market: string | null
  image_url?: string | null
  source_url?: string | null
  task_id: string | null
  task_status: 'open' | 'processing' | 'done' | 'cancelled' | null
  assigned_to: string | null
  is_followed: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent' | null
  task_note: string | null
}

export type BusinessFlowBusItem = Pick<BusinessFlowItem,
  'id' | 'type' | 'name' | 'work_item_id' | 'object_refs' | 'lifecycle_status' | 'lifecycle_label'
  | 'evidence_summary' | 'evidence_completeness' | 'stage_key' | 'stage_name' | 'status' | 'route'
  | 'next_action_route' | 'source' | 'signal' | 'next_action' | 'gaps' | 'source_refs'
  | 'platform' | 'market' | 'image_url' | 'source_url' | 'task_id' | 'task_status' | 'assigned_to' | 'is_followed' | 'priority'
>

export interface BusinessFlowStageHealth {
  stage_key: string
  label: string
  status: BusinessFlowStage['status']
  object_count: number
  blocked_count: number
  data_required_count: number
  ready_count: number
  health_pct: number
  route: string
  next_action_route: string
  next_action: string
  data_gaps: string[]
  source_refs: CockpitSourceRef[]
}

export interface BusinessFlowPipelineLane {
  stage_key: string
  label: string
  status: BusinessFlowStage['status']
  object_count: number
  blocked_count: number
  data_required_count: number
  route: string
  items: BusinessFlowBusItem[]
}

export interface BusinessFlowNextAction {
  type: 'work_item' | 'stage'
  label: string
  route: string
  stage_key: string
  stage_label: string
  reason: string
  primary: boolean
  work_item_id: string | null
  object_refs?: BusinessFlowItem['object_refs']
}

export interface BusinessFlowOverview {
  generated_at: string
  current_username: string | null
  stages: BusinessFlowStage[]
  items: BusinessFlowItem[]
  stage_health: BusinessFlowStageHealth[]
  product_pipeline: BusinessFlowPipelineLane[]
  pending_queue: BusinessFlowBusItem[]
  current_context: BusinessFlowBusItem | null
  next_actions: BusinessFlowNextAction[]
  model_definition?: {
    stage_model: string
    stage_count: number
    description: string
    design_alignment: string
    selection_subflow: string
    object_state_contract: string
    stage_mapping: Record<string, string>
  }
  metrics: {
    stage_count: number
    blocked: number
    data_required: number
    source_count: number
    item_count: number
    item_blocked: number
    item_data_required: number
    task_count: number
    assigned_to_me: number
    followed: number
    exceptions: number
  }
  source_refs: CockpitSourceRef[]
  gaps: string[]
}

export interface BusinessFlowTaskItemRef {
  item_type: string
  item_id: string
  stage_key: string
  title: string
  route: string
  source_refs: CockpitSourceRef[]
  last_gap?: string | null
}

export interface BusinessFlowTaskBulkRequest {
  action: 'assign' | 'follow' | 'unfollow' | 'set_status' | 'set_priority'
  items: BusinessFlowTaskItemRef[]
  assigned_to?: string | null
  status?: 'open' | 'processing' | 'done' | 'cancelled' | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  note?: string | null
}

export interface BusinessFlowTaskResult {
  id: string
  item_type: string
  item_id: string
  stage_key: string
  title: string
  route: string
  status: string
  priority: string
  assigned_to: string | null
  is_followed: boolean
  last_gap: string | null
  note: string | null
  updated_at: string | null
}

export interface BusinessFlowTaskEvent {
  id: string
  action: string
  resource_id: string
  detail: string | null
  payload: Record<string, unknown>
  old_payload: Record<string, unknown> | null
  created_at: string | null
  username: string
}

export interface BusinessFlowTaskCommentRequest {
  comment: string
}

export interface BusinessFlowTaskCompleteReviewRequest {
  outcome: string
  impact_score: number
  next_action?: string | null
}

export interface BusinessFlowAssignee {
  id: string
  username: string
  display_name: string
  is_current: boolean
}
