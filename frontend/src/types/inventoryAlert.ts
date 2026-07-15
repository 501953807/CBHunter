export interface InventoryAlertRule {
  id: string
  user_id: string
  product_id: string
  sku: string
  product_name: string
  safety_stock: number
  enabled: boolean
  severity: string
  created_at?: string
  updated_at?: string
}

export interface InventoryAlertLog {
  id: string
  rule_id: string
  user_id: string
  product_id: string
  sku: string
  product_name: string
  current_stock: number
  threshold: number
  severity: string
  status: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  cleared_at: string | null
  created_at?: string
}

export interface AlertStats {
  total_rules: number
  total_open: number
  critical: number
  warning: number
  info: number
}

export interface InventoryRiskWorkbenchSnapshot {
  stockout: {
    count: number
    items: Array<{
      alert_id: string
      product_id: string
      sku: string
      product_name: string
      current_stock: number
      threshold: number
      shortage: number
      severity: string
    }>
  }
  capital: {
    total_rmb: number
    missing_cost_count: number
    items: Array<{
      listing_id: string
      product_id: string
      platform?: string | null
      platform_account_id?: string | null
      account_name?: string | null
      market?: string | null
      sku: string
      title: string
      stock: number
      unit_cost_rmb: number
      capital_rmb: number
    }>
  }
  slow_moving: {
    count: number
    missing_performance_count: number
    items: Array<{
      listing_id: string
      product_id: string
      platform?: string | null
      platform_account_id?: string | null
      account_name?: string | null
      market?: string | null
      sku: string
      title: string
      stock: number
      views_30d: number
      orders_30d: number
      unit_cost_rmb?: number | null
      capital_rmb?: number | null
      route: string
    }>
  }
  fulfillment_overdue: {
    count: number
    items: Array<{
      order_id: string
      order_number: string
      status: string
      severity: string
      deadline_at: string | null
      hours_to_deadline: number | null
      route: string
    }>
  }
  actions: Array<{
    label: string
    count: number
    route: string
    priority: string
  }>
  data_gaps: string[]
}
