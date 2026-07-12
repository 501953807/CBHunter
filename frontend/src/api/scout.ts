import client from './client'
import type { ApiResponse } from '../types/common'
import type { ProductRecommendation } from '../types/recommender'

export interface DecisionScores {
  weight: number
  competition: number
  margin: number
  video_show: number
  seasonality: number
  supplier_count: number
  repurchase: number
  pain_point: number
  price: number
}

export interface ProductDecisionContext {
  work_item_id: string
  object_refs: ProductRecommendation['object_refs']
  product_name: string
  target_platform: string
  target_market: string
}

export async function decideProduct(data: DecisionScores & ProductDecisionContext) {
  const res = await client.post<ApiResponse>('/scout/decide', data)
  return res.data
}

export interface DecisionPolicy {
  green_threshold: number
  yellow_threshold: number
  green_required: number
  yellow_required: number
  dimensions: Array<{ key: keyof DecisionScores; label: string; help: string }>
  decisions: Record<string, { label: string; action: string }>
}

export async function getDecisionConfig() {
  const res = await client.get<ApiResponse<DecisionPolicy>>('/scout/decision-config')
  return res.data
}

export async function listTrendingProducts(params?: {
  page?: number
  page_size?: number
  platform?: string
  keyword?: string
  category?: string
  market?: string
}) {
  const res = await client.get<ApiResponse<{ items: any[]; total: number; platform_counts: Record<string, number> }>>('/scout/trending-products', { params })
  return res.data
}

export async function captureTrendingProduct(data: {
  trending_id: string
  market?: string
  product_url?: string
  tags?: string[]
}) {
  const res = await client.post<ApiResponse>('/scout/trending-products/capture', data)
  return res.data
}

export async function deleteTrendingProduct(id: string) {
  const res = await client.delete<ApiResponse<{ deleted: boolean }>>(`/scout/trending-products/${id}`)
  return res.data
}

export async function listSupplyProducts(params?: {
  page?: number
  page_size?: number
  keyword?: string
}) {
  const res = await client.get<ApiResponse<{ items: any[]; total: number }>>('/scout/supply-products', { params })
  return res.data
}

export async function addSupplyProductToDiscovery(supplyProductId: string) {
  const res = await client.post<ApiResponse>('/scout/supply-products/add-to-discovery', { supply_product_id: supplyProductId })
  return res.data
}

export async function deleteSupplyProduct(id: string) {
  const res = await client.delete<ApiResponse<{ deleted: boolean }>>(`/scout/supply-products/${id}`)
  return res.data
}

export async function listScoutSources() {
  const res = await client.get<ApiResponse<any[]>>('/scout/sources')
  return res.data
}

export async function getScoutFunnel() {
  const res = await client.get<ApiResponse<any>>('/scout/funnel')
  return res.data
}

export async function createScoutSignal(data: Record<string, unknown>) {
  const res = await client.post<ApiResponse>('/scout/signals', data)
  return res.data
}

export async function createScoutPrompt(data: Record<string, unknown>) {
  const res = await client.post<ApiResponse>('/scout/prompts', data)
  return res.data
}

export async function listCapturedTrendingProducts(params?: { platform?: string; page_size?: number }) {
  const res = await client.get<ApiResponse<{ items: any[]; total?: number }>>('/scout/captured-trending-products', { params })
  return res.data
}

export async function deleteCapturedTrendingProduct(id: string) {
  const res = await client.delete<ApiResponse>(`/scout/captured-trending-products/${id}`)
  return res.data
}

export async function listScoutPrompts() {
  const res = await client.get<ApiResponse<any[]>>('/scout/prompts')
  return res.data
}
