export interface ProfitScenario {
  selling_price_local: number
  selling_price_rmb: number
  platform_fee_rmb: number
  net_profit_rmb: number
  profit_margin_pct: number
}

export interface FullProfitAnalysis {
  status?: 'ready' | 'data_required' | 'configuration_required'
  note?: string
  message?: string
  data_gaps?: string[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  purchase_cost_rmb: number
  weight_g: number
  target_platform: string
  target_market: string
  platform_display: string
  market_display: string
  currency: string
  exchange_rate: number
  shipping_cost_rmb: number
  commission_rate: number
  transaction_fee_rate: number
  scenarios: ProfitScenario[]
  recommended_price: number | null
  recommended_markup: number | null
  breakeven_price_local: number | null
  breakeven_price_rmb: number | null
}

export interface QuickProfitResult {
  purchase_cost_rmb: number
  weight_g: number
  target_platform: string
  target_market: string
  suggested_selling_price_local: number
  suggested_selling_price_rmb_equiv: number
  shipping_cost_rmb: number
  platform_commission_rmb: number
  transaction_fee_rmb: number
  total_cost_rmb: number
  net_profit_rmb: number
  profit_margin_pct: number
  markup_from_cost: number
  is_viable: boolean
  viability_label: string
  note: string
}

export interface PlatformMarket {
  platform: string
  market: string
  label: string
  currency: string
  commission_rate: number
}
