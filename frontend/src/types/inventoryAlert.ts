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
