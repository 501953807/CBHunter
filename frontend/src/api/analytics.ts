import client from './client'
import type { ApiResponse } from '../types/common'

export interface DashboardKPI {
  status: 'ready' | 'data_required'
  total_sales: number
  order_count: number
  avg_order_value: number
  active_listings: number
  active_products: number
  sales_change_pct: number | null
  period: string
  source_refs: AnalyticsSourceRef[]
  evidence_window: string
  confidence_reason: string
  data_gaps: string[]
}

export interface AnalyticsSourceRef {
  type: string
  id?: string
  field?: string
  label?: string
}

export interface AnalyticsEvidence {
  status: 'ready' | 'data_required'
  source_refs: AnalyticsSourceRef[]
  evidence_window: string
  confidence_reason: string
  data_gaps: string[]
}

export interface SalesTrendPoint {
  date: string
  sales: number
  orders: number
}

export interface PlatformMetric {
  platform: string
  sales: number
  orders: number
}

export interface ProductPerformance {
  top_performers: { name: string; revenue: number; units: number }[]
  bottom_performers: { name: string; price: number | null; days_without_sale: number | null; status: 'no_sales_record' }[]
}

export type SalesTrendResult = AnalyticsEvidence & { period: string; data: SalesTrendPoint[] }
export type PlatformComparisonResult = AnalyticsEvidence & { items: PlatformMetric[] }

export async function getDashboardKPIs() {
  const res = await client.get<ApiResponse<DashboardKPI>>('/analytics/dashboard')
  return res.data
}

export async function getSalesTrend(period = '7d') {
  const res = await client.get<ApiResponse<SalesTrendResult>>('/analytics/sales-trend', { params: { period } })
  return res.data
}

export async function getPlatformComparison() {
  const res = await client.get<ApiResponse<PlatformComparisonResult>>('/analytics/platform-comparison')
  return res.data
}

export async function getProductPerformance() {
  const res = await client.get<ApiResponse<ProductPerformance>>('/analytics/product-performance')
  return res.data
}
