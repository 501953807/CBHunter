import client from './client'
import type { ApiResponse, PaginationMeta } from '../types/common'
import type { SourcingItem, SourcingPipelineSummary, SourcingSupplier } from '../types/sourcing'

export async function listSourcingItems(params?: {
  platform?: string
  pipeline_stage?: string
  category?: string
  search?: string
  page?: number
  page_size?: number
}) {
  const res = await client.get<ApiResponse<SourcingItem[]> & { meta?: PaginationMeta }>('/sourcing', { params })
  return res.data
}

export async function createSourcingItem(data: {
  source_price_rmb?: number | null
  product_name: string
  product_name_cn?: string
  weight_g?: number
  platform?: string
  market?: string
  category?: string
  pipeline_stage?: string
  source_url?: string
  notes?: string
  tags?: string[]
}) {
  const res = await client.post<ApiResponse<SourcingItem>>('/sourcing', data)
  return res.data
}

export async function updateSourcingItem(id: string, data: Partial<SourcingItem>) {
  const res = await client.put<ApiResponse<SourcingItem>>(`/sourcing/${id}`, data)
  return res.data
}

export async function deleteSourcingItem(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/sourcing/${id}`)
  return res.data
}

export async function getPipelineSummary() {
  const res = await client.get<ApiResponse<SourcingPipelineSummary>>('/sourcing/pipeline')
  return res.data
}

export interface AddToSourcingRequest {
  source_name: string
  source_type: string
  product_name: string
  product_name_cn?: string
  category?: string
  platform?: string
  market?: string
  source_price_rmb?: number
  price_min?: number
  price_max?: number
  notes?: string
  source_url?: string
  source_image?: string
  extra_data?: Record<string, unknown>
}

export async function addToSourcing(data: AddToSourcingRequest) {
  const res = await client.post<ApiResponse>('/sourcing/from-product', data)
  return res.data
}

export async function search1688Suppliers(product_name: string, category?: string) {
  const params: Record<string, string> = { product_name }
  if (category) params.category = category
  const res = await client.get<ApiResponse<{ suggestions: { query: string; url: string; type: string; label: string }[]; note: string; domain: string }>>('/sourcing/search-1688', { params })
  return res.data
}

export async function listSourcingSuppliers(itemId: string) {
  const res = await client.get<ApiResponse<SourcingSupplier[]>>(`/sourcing/${itemId}/suppliers`)
  return res.data
}

export async function createSourcingSupplier(data: Record<string, unknown>) {
  const res = await client.post<ApiResponse>('/sourcing/suppliers', data)
  return res.data
}

export async function updateSourcingStage(itemId: string, targetStage: string) {
  const res = await client.put<ApiResponse>(`/sourcing/${itemId}/stage`, { target_stage: targetStage })
  return res.data
}

export async function calculateSourcingCost(itemId: string, data: Record<string, unknown>) {
  const res = await client.post<ApiResponse<any>>(`/sourcing/${itemId}/calculate-cost`, data)
  return res.data
}

export async function recordSourcingPurchase(itemId: string, data: {
  supplier_id?: string | null
  quantity: number
  unit_cost_rmb: number
  domestic_shipping_rmb?: number
  description?: string | null
}) {
  const res = await client.post<ApiResponse<any>>(`/sourcing/${itemId}/record-purchase`, data)
  return res.data
}
