import client from './client'
import type { ApiResponse } from '../types/common'
import type { DashboardSummary } from '../types/sourcing'

export interface BlueOceanOpportunity {
  keyword_id: string
  keyword: string
  market: string
  category: string
  blue_ocean_score: number
  evidence_completeness_pct: number
  missing_dimensions: string[]
  opportunity_level: string
  recommendation: string
  dimensions?: {
    trend_strength?: number | null
    profit_potential?: number | null
    competition_gap?: number | null
    supply_chain?: number | null
    profit_detail?: { avg_margin_pct?: number | null }
  }
}

export interface BlueOceanResponse {
  status?: 'ready' | 'data_required'
  opportunities: BlueOceanOpportunity[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
}

export async function getDashboardSummary() {
  const res = await client.get<ApiResponse<DashboardSummary>>('/dashboard/summary')
  return res.data
}

export async function getBlueOceanOpportunities(params?: { market?: string; limit?: number }) {
  const res = await client.get<ApiResponse<BlueOceanResponse>>('/dashboard/blue-ocean', { params })
  return res.data
}
