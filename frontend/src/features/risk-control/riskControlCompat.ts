import type { RiskControlOverview } from '../../types/riskControl'

export function normalizeRiskControlOverview(input: RiskControlOverview | null): RiskControlOverview | null {
  if (!input) return null
  const raw = input as any
  const risks = Array.isArray(raw.risks) ? raw.risks : []
  const gaps = Array.isArray(raw.gaps) ? raw.gaps : Array.isArray(raw.data_gaps) ? raw.data_gaps : []
  const riskCategories = Array.isArray(raw.risk_categories) ? raw.risk_categories : []
  const emptySnapshot = { active: 0, critical: 0, warning: 0, events: 0 }
  return {
    ...raw,
    generated_at: raw.generated_at || new Date().toISOString(),
    assessment_status: raw.assessment_status || (risks.length > 0 ? 'attention' : 'insufficient'),
    metrics: {
      pending: 0,
      processing: 0,
      closed: 0,
      overdue: 0,
      critical: 0,
      warning: 0,
      source_count: 0,
      category_count: riskCategories.length,
      ...(raw.metrics || {}),
    },
    risk_sla_templates: raw.risk_sla_templates || {
      account: { critical: 12, warning: 24, info: 72 },
      business: { critical: 24, warning: 72, info: 120 },
      compliance: { critical: 12, warning: 48, info: 120 },
      logistics: { critical: 6, warning: 24, info: 72 },
      currency: { critical: 24, warning: 72, info: 120 },
      inventory: { critical: 24, warning: 72, info: 120 },
    },
    risk_categories: riskCategories,
    risk_radar: Array.isArray(raw.risk_radar) ? raw.risk_radar : riskCategories.map((item: any) => ({
      key: item.key,
      label: item.label,
      route: item.route,
      active_count: Number(item.active_count || 0),
      critical: 0,
      warning: 0,
      overdue: 0,
      closed: 0,
      score: item.status === 'attention' ? 70 : item.status === 'data_required' ? 30 : 0,
      status: item.status || 'data_required',
      data_gaps: Array.isArray(item.data_gaps) ? item.data_gaps : [],
    })),
    risk_heatmap: Array.isArray(raw.risk_heatmap) ? raw.risk_heatmap : riskCategories.map((item: any) => ({
      category: item.key,
      label: item.label,
      route: item.route,
      critical: 0,
      warning: 0,
      processing: 0,
      closed: 0,
      total: Number(item.active_count || 0),
      heat_level: item.status === 'attention' ? 'warning' : item.status === 'data_required' ? 'data_required' : 'clear',
    })),
    risk_store_matrix: Array.isArray(raw.risk_store_matrix) ? raw.risk_store_matrix : [],
    risk_platform_matrix: Array.isArray(raw.risk_platform_matrix) ? raw.risk_platform_matrix : [],
    location_gap_queue: Array.isArray(raw.location_gap_queue) ? raw.location_gap_queue : [],
    comparison: {
      current: { ...emptySnapshot, ...(raw.comparison?.current || {}) },
      previous: { ...emptySnapshot, ...(raw.comparison?.previous || {}) },
      last_year: { ...emptySnapshot, ...(raw.comparison?.last_year || {}) },
      rates: {
        active_mom_pct: raw.comparison?.rates?.active_mom_pct ?? null,
        active_yoy_pct: raw.comparison?.rates?.active_yoy_pct ?? null,
        critical_mom_pct: raw.comparison?.rates?.critical_mom_pct ?? null,
        critical_yoy_pct: raw.comparison?.rates?.critical_yoy_pct ?? null,
      },
      windows: {
        current: raw.comparison?.windows?.current || '',
        previous: raw.comparison?.windows?.previous || '',
        last_year: raw.comparison?.windows?.last_year || '',
      },
    },
    ai_recommendations: Array.isArray(raw.ai_recommendations) ? raw.ai_recommendations : [],
    review_records: Array.isArray(raw.review_records) ? raw.review_records : [],
    risks: risks.map((risk: any) => ({
      ...risk,
      estimated_impact: risk.estimated_impact || '影响范围待根据关联业务记录进一步确认。',
      response_deadline_at: risk.response_deadline_at || risk.due_at || null,
      remaining_time_label: risk.remaining_time_label || (risk.is_overdue ? '已超期' : '未设置'),
      sla_hours: typeof risk.sla_hours === 'number' ? risk.sla_hours : null,
      sla_template_key: risk.sla_template_key || risk.type || null,
      sla_template_hours: typeof risk.sla_template_hours === 'number' ? risk.sla_template_hours : null,
    })),
    source_refs: Array.isArray(raw.source_refs) ? raw.source_refs : [],
    gaps,
    gap_actions: Array.isArray(raw.gap_actions) ? raw.gap_actions : gaps.map((gap: string) => ({
      category: '数据缺口',
      priority: '中',
      detail: gap,
      route: '/reports',
      action_label: '前往补齐数据',
    })),
  }
}
