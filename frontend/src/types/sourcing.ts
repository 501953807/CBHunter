export interface SourcingItem {
  id: string
  source_name: string
  source_url: string | null
  source_price_rmb: number | null
  product_name: string
  product_name_cn: string | null
  weight_g: number | null
  category: string | null
  platform: string | null
  market: string | null
  pipeline_stage: string
  price_review_status: string | null
  price_review_note: string | null
  jit_stock: number | null
  vmi_stock: number | null
  selling_price_local: number | null
  monthly_sales: number | null
  profit_margin_pct: number | null
  domestic_shipping_rmb: number | null
  intl_shipping_rmb: number | null
  packaging_cost_rmb: number | null
  platform_fee_pct: number | null
  payment_fee_pct: number | null
  return_reserve_pct: number | null
  exchange_rate: number | null
  total_cost_rmb: number | null
  listing_url: string | null
  notes: string | null
  tags: string[] | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface SourcingPipelineSummary {
  total: number
  discovery: number
  jit_testing: number
  jit_passed: number
  price_review: number
  vmi: number
  active: number
  discontinued: number
  by_platform: Record<string, number>
}

export interface SourcingSupplier {
  id: string
  sourcing_item_id: string
  supplier_name: string
  supplier_url?: string | null
  product_image?: string | null
  purchase_price_rmb?: number | null
  shipping_estimate_rmb?: number | null
  moq?: number | null
  notes?: string | null
  rating?: string | null
  is_preferred: boolean
  created_at?: string | null
}

export interface DashboardSummary {
  layer_counts: {
    trend: number
    platform: number
    supply: number
    culture: number
  }
  pipeline: SourcingPipelineSummary
  pending: {
    pending_analysis: number
    pending_decision: number
  }
  recent_activity: {
    id: string
    product_name: string
    stage: string
    updated_at: string | null
  }[]
}

export interface NetworkStatus {
  status: 'domestic' | 'overseas' | 'offline'
  overseas: boolean
  domestic: boolean
}

export interface CostResult {
  total_cost_rmb: number
  profit_rmb: number
  profit_margin_pct: number
  breakeven_units: number
  details: Record<string, number>
}
