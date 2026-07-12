import client from './client'
import type { ApiResponse } from '../types/common'
import type { FullProfitAnalysis, QuickProfitResult, PlatformMarket } from '../types/profitability'

export async function calculateProfit(data: {
  purchase_cost_rmb: number
  weight_g: number
  platform: string
  market: string
  shipping_cost_rmb?: number
  markup_pct: number
}) {
  const res = await client.post<ApiResponse<FullProfitAnalysis>>('/profitability/calculate', data)
  return res.data
}

export async function quickProfit(cost: number, weight: number, platform: string, market: string) {
  const res = await client.get<ApiResponse<QuickProfitResult>>('/profitability/quick', {
    params: { cost, weight, platform, market }
  })
  return res.data
}

export async function listPlatforms() {
  const res = await client.get<ApiResponse<PlatformMarket[]>>('/profitability/platforms/list')
  return res.data
}
