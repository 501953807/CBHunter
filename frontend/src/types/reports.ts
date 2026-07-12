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
  expected: number
  actual: number
  deviation_pct: number
}

export interface Report {
  date: string
  period: string
  summary: ReportSummary
  by_platform: PlatformBreakdown[]
  by_market: PlatformBreakdown[]
  top_products: TopProduct[]
  anomalies: AnomalyItem[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
  data_quality?: {
    cost_status: 'complete' | 'missing'
    total_items: number
    costed_items: number
    missing_cost_items: number
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
