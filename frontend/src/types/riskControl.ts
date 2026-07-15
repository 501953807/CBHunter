import type { CockpitSourceRef } from './cockpit'

export interface RiskControlRisk {
  id: string
  type: string
  type_label?: string
  title: string
  severity: 'critical' | 'warning' | 'info'
  status: 'pending' | 'processing' | 'closed' | 'ignored'
  detail: string
  route: string
  estimated_impact: string
  response_deadline_at: string | null
  remaining_time_label: string
  sla_hours: number | null
  evidence_window: string
  source_refs: CockpitSourceRef[]
  assigned_to: string | null
  due_at: string | null
  is_overdue: boolean
  note: string | null
  closed_at: string | null
  updated_at: string | null
  platform?: string | null
  platform_account_id?: string | null
  account_name?: string | null
  market?: string | null
}

export interface RiskControlOverview {
  generated_at: string
  assessment_status: 'attention' | 'insufficient' | 'clear'
  metrics: {
    pending: number
    processing: number
    closed: number
    overdue: number
    critical: number
    warning: number
    source_count: number
    category_count: number
  }
  risk_categories: Array<{
    key: string
    label: string
    route: string
    description: string
    active_count: number
    status: 'attention' | 'data_required' | 'clear'
    data_gaps: string[]
  }>
  risk_radar: Array<{
    key: string; label: string; route: string; active_count: number
    critical: number; warning: number; overdue: number; closed: number
    score: number; status: 'attention' | 'data_required' | 'clear'; data_gaps: string[]
  }>
  risk_heatmap: Array<{
    category: string; label: string; route: string; critical: number
    warning: number; processing: number; closed: number; total: number
    heat_level: 'critical' | 'warning' | 'data_required' | 'clear'
  }>
  risk_store_matrix: Array<{
    platform_account_id: string | null
    account_name: string
    platform: string
    market: string | null
    critical: number
    warning: number
    processing: number
    overdue: number
    total: number
  }>
  risk_platform_matrix: Array<{
    platform: string
    critical: number
    warning: number
    processing: number
    overdue: number
    total: number
  }>
  comparison: {
    current: { active: number; critical: number; warning: number; events: number }
    previous: { active: number; critical: number; warning: number; events: number }
    last_year: { active: number; critical: number; warning: number; events: number }
    rates: {
      active_mom_pct: number | null
      active_yoy_pct: number | null
      critical_mom_pct: number | null
      critical_yoy_pct: number | null
    }
    windows: { current: string; previous: string; last_year: string }
  }
  ai_recommendations: Array<{
    risk_id: string; title: string; type: string; severity: RiskControlRisk['severity']
    recommendation: string; route: string; source_refs: CockpitSourceRef[]
    status: 'suggested'; does_not_change_state: boolean
  }>
  review_records: Array<{
    risk_id: string; title: string; type: string; type_label?: string
    outcome: string; closed_at: string | null; note: string | null
    route: string; source_refs: CockpitSourceRef[]
  }>
  risks: RiskControlRisk[]
  source_refs: CockpitSourceRef[]
  gaps: string[]
  gap_actions: { category: string; priority: string; detail: string; route: string; action_label?: string }[]
}

export interface RiskStateUpdateRequest {
  status: RiskControlRisk['status']
  assigned_to?: string | null
  due_at?: string | null
  note?: string | null
}

export interface RiskAuditItem {
  id: string
  action: string
  resource_id: string
  old_value: string | null
  new_value: string | null
  detail: string | null
  created_at: string
}
