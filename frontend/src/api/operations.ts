import client from './client'
import type { ApiResponse } from '../types/common'

export interface OperationRecord {
  id: string
  record_type: string
  status: string
  name: string
  platform?: string | null
  market?: string | null
  counterparty?: string | null
  planned_amount_rmb?: number | null
  actual_amount_rmb?: number | null
  currency: string
  due_at?: string | null
  completed_at?: string | null
  notes?: string | null
  ledger_entry_id?: string | null
  created_at: string
  updated_at: string
}

export interface OperationOption {
  id: string
  label: string
  ledger_entry_type?: string
}

export interface OperationOptions {
  record_types: OperationOption[]
  statuses: OperationOption[]
}

export interface ProductOperationMetrics {
  summary: {
    listing_count: number
    diagnostic_count: number
    action_count: number
    reviewed_action_count?: number
    pending_action_count?: number
  }
  items: ProductOperationMetricItem[]
  data_status: 'ready' | 'data_required'
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
}

export interface ProductOperationMetricItem {
  listing_id: string
  product_id: string
  product_name: string
  sku: string | null
  listing_title: string
  platform: string | null
  account_name: string | null
  market: string | null
  status: string
  metrics: {
    impressions_30d: number | null
    views_30d: number | null
    orders_30d: number | null
    sales_amount_30d: number | null
    conversion_rate_pct: number | null
    favorites_30d: number | null
    rating: number | null
    reviews_30d: number | null
    stock: number
  }
  diagnostics: Array<{ code: string; level: 'critical' | 'warning' | 'info'; title: string; detail: string }>
  growth_actions: Array<{ label: string; route: string; reason: string }>
  operation_feedback: {
    has_review: boolean
    record_id: string | null
    record_name: string | null
    status: string | null
    completed_at: string | null
    review_result: string | null
    effect_summary: string | null
    pending_count: number
    reviewed_count: number
  }
  data_gaps: string[]
}

export async function listOperationRecords(recordType?: string) {
  const res = await client.get<ApiResponse<OperationRecord[]>>('/operations', { params: { page_size: 100, record_type: recordType } })
  return res.data
}

export async function getOperationOptions() {
  const res = await client.get<ApiResponse<OperationOptions>>('/operations/options')
  return res.data
}

export async function getProductOperationMetrics() {
  const res = await client.get<ApiResponse<ProductOperationMetrics>>('/operations/product-metrics')
  return res.data
}

export async function createProductOperationAction(data: { listing_id: string; diagnostic_code: string }) {
  const res = await client.post<ApiResponse<OperationRecord>>('/operations/product-actions', data)
  return res.data
}

export async function createOperationRecord(data: Record<string, unknown>) {
  const res = await client.post<ApiResponse<OperationRecord>>('/operations', data)
  return res.data
}

export async function updateOperationRecord(id: string, data: Record<string, unknown>) {
  const res = await client.put<ApiResponse<OperationRecord>>(`/operations/${id}`, data)
  return res.data
}

export async function deleteOperationRecord(id: string) {
  const res = await client.delete<ApiResponse>(`/operations/${id}`)
  return res.data
}
