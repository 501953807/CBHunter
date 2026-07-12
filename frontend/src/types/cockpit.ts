export interface CockpitSourceRef {
  type: string
  id: string
  label?: string
  meta?: { source_label?: string; route?: string }
}

export interface CockpitSection<TMetrics, TItem> {
  status: 'ready' | 'data_required'
  source_count: number
  source_refs: CockpitSourceRef[]
  evidence_window: string
  metrics: TMetrics
  items: TItem[]
  gaps: string[]
  actions?: { label: string; route: string; reason: string }[]
}

export interface CockpitData {
  generated_at: string
  data_status: 'ready' | 'data_required'
  attention_count: number
  active_filters: Required<Pick<CockpitFilters, 'start_date' | 'end_date'>> & {
    platform?: string | null
    market?: string | null
    platform_account_id?: string | null
    currency?: string | null
    store_count: number
  }
  sections: {
    orders: CockpitSection<{
      order_count: number
      revenue_by_currency: { currency: string; orders: number; revenue: number }[]
    }, {
      id: string; order_number: string; platform: string | null; status: string
      total: number; currency: string; ordered_at: string
    }>
    finance: CockpitSection<{
      total_revenue_rmb: number | null; total_cost_rmb: number | null
      net_profit_rmb: number | null; profit_margin_pct: number | null; entry_count: number
    }, {
      id: string; entry_type: string; amount_rmb: number; description: string | null; occurred_at: string
    }>
    inventory: CockpitSection<{
      active_listings: number; confirmed_listings: number; confirmed_stock: number
      unknown_stock_listings: number; open_alerts: number
    }, {
      id: string; title: string; stock: number; status: string
    }>
    product_operations: CockpitSection<{
      listing_count: number; diagnosed_listing_count: number; action_record_count: number
      pending_action_count: number; reviewed_action_count: number
    }, {
      listing_id: string; title: string; stock: number
      views_30d: number | null; orders_30d: number | null; conversion_rate_pct: number | null
      diagnostic_code: string; diagnostic_title: string; diagnostic_detail: string
      record_id: string | null; record_name: string | null
      review_result: string | null; effect_summary: string | null
      pending_count: number; reviewed_count: number; route: string
    }>
    competitors: CockpitSection<{
      tracked: number; price_changes_detected: number
    }, {
      id: string; platform: string; name: string; price: number | null
      previous_price: number | null; last_updated: string
    }>
    alerts: CockpitSection<{
      open: number; critical: number; warning: number
    }, {
      id: string; product_name: string; current_stock: number; threshold: number
      severity: string; created_at: string
    }>
    reports: CockpitSection<{
      today_orders: number; anomaly_count: number; cost_status: string
    }, {
      metric: string; expected: number; actual: number; deviation_pct: number
    }>
    ai_suggestions: CockpitSection<{
      active: number; unread: number; critical_unread: number
    }, {
      id: string; title: string; severity: string; confidence: number | null
      source_refs: CockpitSourceRef[]; evidence_window: string | null; confidence_reason: string | null
    }>
    store_matrix: CockpitSection<{
      store_count: number; active_store_count: number; platform_count: number
      order_count: number; active_listings: number
    }, {
      id: string; platform: string; account_name: string; market: string; status: string
      order_count: number; active_listings: number
      revenue_by_currency: { currency: string; orders: number; revenue: number }[]
      last_sync_at: string
    }>
    risk_summary: CockpitSection<{
      active_risk_count: number; critical: number; warning: number
    }, {
      key: string; object_type: string; object_id: string; title: string
      severity: string; detail: string; route: string
    }>
    flow_summary: CockpitSection<{
      stage_count: number; blocked: number; ready: number; data_required: number
    }, {
      stage_key: string; label: string; route: string; object_count: number
      status: string; gap: string; next_action: string; source_refs: CockpitSourceRef[]
    }>
  }
}

export interface CockpitFilters {
  start_date?: string
  end_date?: string
  platform?: string
  market?: string
  platform_account_id?: string
  currency?: string
}
