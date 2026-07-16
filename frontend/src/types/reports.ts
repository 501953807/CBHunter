export interface ReportSummary {
  total_revenue: number
  total_orders: number
  total_cost: number | null
  gross_profit: number | null
  profit_margin_pct: number | null
}

export interface PlatformBreakdown {
  platform: string
  revenue: number
  orders: number
}

export interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

export interface AnomalyItem {
  metric: string
  expected: number | string
  actual: number | string
  deviation_pct: number
  risk_code?: string
  title?: string
  level?: string
  detail?: string
  action_label?: string
  action_route?: string
}

export interface ReportFinancialRiskSignal {
  code: string
  level: 'info' | 'medium' | 'high' | string
  title: string
  detail: string
  action_label: string
  action_route: string
}

export interface Report {
  date: string
  period: string
  summary: ReportSummary
  by_platform: PlatformBreakdown[]
  by_market: PlatformBreakdown[]
  top_products: TopProduct[]
  anomalies: AnomalyItem[]
  financial_risk_signals?: ReportFinancialRiskSignal[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
  data_quality?: {
    cost_status: 'complete' | 'missing'
    total_items: number
    costed_items: number
    missing_cost_items: number
    finance_risk_count?: number
  }
}

export interface ReportSubscription {
  id: string
  user_id: string
  channel: string
  frequency: string
  enabled: boolean
  last_sent_at?: string
  created_at?: string
}
