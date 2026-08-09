import client from './client'
import type { ApiResponse } from '../types/common'

export interface PromotionCampaignItem {
  id: string
  platform_listing_id: string
  product_id: string
  product_name: string
  listing_title: string
  sku?: string | null
  discount_type: string
  discount_value?: number | null
  original_price?: number | null
  promotion_price?: number | null
  discount_amount?: number | null
  stock_limit?: number | null
  status: string
}

export interface PromotionPriceSummary {
  priced_item_count: number
  original_price_total: number
  promotion_price_total: number
  discount_amount_total: number
  avg_discount_pct?: number | null
  source: string
  note: string
}

export interface PromotionCampaign {
  id: string
  name: string
  promotion_type: string
  status: string
  platform: string
  store: {
    id: string
    account_name: string
    shop_id?: string | null
    market?: string | null
  }
  starts_at?: string | null
  ends_at?: string | null
  external_promotion_id?: string | null
  stack_rule?: string | null
  source: string
  platform_data?: Record<string, unknown> | null
  product_count: number
  price_summary: PromotionPriceSummary
  items: PromotionCampaignItem[]
}

export interface PromotionGovernanceSummary {
  campaign_count: number
  platform_count: number
  store_count: number
  participating_item_count: number
  priced_item_count: number
  discount_amount_total: number
  local_campaign_count: number
  platform_sync_gap_count: number
  platform_counts: Record<string, number>
  status_counts: Record<string, number>
  type_counts: Record<string, number>
  runtime_boundary: string
  next_action: string
}

export async function getPromotionCampaigns() {
  const res = await client.get<ApiResponse<PromotionCampaign[]>>('/promotions')
  return res.data
}

export async function createPromotionCampaign(payload: Record<string, unknown>) {
  const res = await client.post<ApiResponse<PromotionCampaign>>('/promotions', payload)
  return res.data
}

export async function updatePromotionCampaign(campaignId: string, payload: Record<string, unknown>) {
  const res = await client.patch<ApiResponse<PromotionCampaign>>(`/promotions/${campaignId}`, payload)
  return res.data
}

export async function updatePromotionCampaignStatus(campaignId: string, status: string) {
  const res = await client.patch<ApiResponse<PromotionCampaign>>(`/promotions/${campaignId}/state`, { status })
  return res.data
}

export async function addPromotionCampaignItems(campaignId: string, items: Record<string, unknown>[]) {
  const res = await client.post<ApiResponse<PromotionCampaign>>(`/promotions/${campaignId}/items`, { items })
  return res.data
}

export async function updatePromotionCampaignDiscount(campaignId: string, discountValue: number) {
  const res = await client.patch<ApiResponse<PromotionCampaign>>(`/promotions/${campaignId}/discount`, { discount_value: discountValue })
  return res.data
}

export async function syncPromotionCampaign(campaignId: string) {
  const res = await client.post<ApiResponse<PromotionCampaign>>(`/promotions/${campaignId}/sync`)
  return res.data
}
