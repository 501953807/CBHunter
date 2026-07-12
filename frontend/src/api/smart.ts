import client from './client'
import type { ApiResponse } from '../types/common'

export async function searchRadar(keywords: string[], market: string) {
  const res = await client.post<ApiResponse<{ results: any[] }>>('/smart/radar/search', keywords, { params: { market } })
  return res.data
}

export async function crossValidate1688(params: { market: string; limit?: number }) {
  const res = await client.post<ApiResponse<{ results: any[] }>>('/smart/cross-validate', null, { params })
  return res.data
}

export async function crossValidateTrends(data: {
  category: string
  google_keywords: { keyword: string }[]
  pinterest_keywords: { keyword: string }[]
}) {
  const res = await client.post<ApiResponse>('/smart/cross-trends', data)
  return res.data
}

export async function listExchangeRates() {
  const res = await client.get<ApiResponse<any[]>>('/smart/exchange-rates')
  return res.data
}

export async function refreshExchangeRates() {
  const res = await client.post<ApiResponse>('/smart/exchange-rates/refresh')
  return res.data
}

export async function calculateSmartProfit(data: { cost_rmb: number; shipping_rmb: number; markup_pct: number }) {
  const res = await client.post<ApiResponse<{ results: any[] }>>('/smart/profit-calc', data)
  return res.data
}
