import client from './client'
import type { ApiResponse } from '../types/common'
import type { MediaReadiness, PlatformListingRequirements } from './content'

export interface PriceRecommendationRequest {
  source_price_rmb: number
  platform: string
  market: string
  target_profit_pct: number
  pricing_mode: 'cost_based' | 'selling_based'
  content_item_id?: string
}

export interface PriceRecommendationItem {
  selling_price: number
  target_margin_pct: number
  net_profit_pct: number
  net_profit_rmb: number
  label: string
  selling_price_local?: number
  currency?: string
  competition_position?: 'below_band' | 'inside_band' | 'above_band'
}

export interface CompetitorPriceBand {
  currency: string
  sample_count: number
  min: number
  median: number
  max: number
}

export interface PriceRecommendationData {
  status: 'ready' | 'configuration_required' | 'data_required'
  source_price_rmb: number
  platform: string
  market: string
  content_item_id?: string
  product_name?: string
  currency?: string
  exchange_rate?: number
  competitor_price_band?: CompetitorPriceBand | null
  estimated_fee_pct: number | null
  recommendations: Partial<Record<'conservative' | 'balanced' | 'aggressive', PriceRecommendationItem>>
  message?: string
  note?: string
  data_gaps?: string[]
}

export interface PricingWorkbenchItem {
  id: string
  work_item_id: string
  object_refs: { type: string; id: string; label: string }[]
  lifecycle_status: string
  lifecycle_label: string
  evidence_completeness: Record<string, 'present' | 'missing' | 'stale' | 'low_confidence'>
  evidence_summary: {
    total: number
    present: number
    missing: number
    stale: number
    low_confidence: number
  }
  product_name: string
  image_url?: string | null
  media_readiness?: MediaReadiness
  source_url?: string | null
  source_name: string
  source_price_rmb: number
  platform: string
  market: string
  pricing_status: 'pricing_required' | 'price_confirmed'
  platform_requirements?: PlatformListingRequirements
  listing_store_override?: {
    schema?: string
    store_id?: string | null
    store_label?: string | null
    title?: string | null
    price?: string | null
    currency?: string | null
    image_urls?: string[]
    image_count?: number
    sku_count?: number
    has_logistics?: boolean
    has_compliance?: boolean
    promotion_note?: string | null
    override_boundary?: string | null
  }
  pricing_confirmation?: Record<string, unknown>
  pricing_inputs?: {
    cost_rmb?: number | null
    target_platform?: string | null
    target_market?: string | null
    content_confirmed?: boolean
  }
  store_options: { id: string; platform: string; account_name: string; shop_id?: string | null }[]
  next_action: string
}

export interface PricingWorkbench {
  status: string
  metrics: { total: number }
  items: PricingWorkbenchItem[]
  data_gaps: string[]
  evidence_window: string
  confidence_reason: string
}

export interface PricingConfirmRequest {
  content_item_id: string
  selling_price_rmb: number
  selling_price_local: number
  currency?: string
  pricing_tier: 'conservative' | 'balanced' | 'aggressive'
  pricing_mode: 'cost_based' | 'selling_based'
  target_profit_pct: number
  platform_account_id?: string
}

export interface PricingConfirmResponse {
  status: 'price_confirmed' | 'configuration_required' | 'data_required'
  content_item_id: string
  product_id?: string
  listing_id?: string
  platform_account_id?: string
  selling_price_local?: number
  selling_price_rmb?: number
  note?: string
  data_gaps?: string[]
}

export async function getPricingWorkbench() {
  const res = await client.get<ApiResponse<PricingWorkbench>>('/pricing/workbench')
  return res.data
}

export async function recommendPrice(data: PriceRecommendationRequest) {
  const res = await client.post<ApiResponse<PriceRecommendationData>>('/pricing/recommend', data)
  return res.data
}

export async function confirmPricing(data: PricingConfirmRequest) {
  const res = await client.post<ApiResponse<PricingConfirmResponse>>('/pricing/confirm', data)
  return res.data
}
