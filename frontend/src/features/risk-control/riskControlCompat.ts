import type { RiskControlOverview } from '../../types/riskControl'

export function normalizeRiskControlOverview(input: RiskControlOverview | null): RiskControlOverview | null {
  if (!input) return null
  const raw = input as any
  const risks = Array.isArray(raw.risks) ? raw.risks : []
  const gaps = Array.isArray(raw.gaps) ? raw.gaps : Array.isArray(raw.data_gaps) ? raw.data_gaps : []
  const riskCategories = Array.isArray(raw.risk_categories) ? raw.risk_categories : []
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
    ai_recommendations: Array.isArray(raw.ai_recommendations) ? raw.ai_recommendations : [],
    review_records: Array.isArray(raw.review_records) ? raw.review_records : [],
    risks,
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
