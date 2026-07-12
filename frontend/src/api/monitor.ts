import client from './client'
import type { ApiResponse } from '../types/common'
import type { CompetitorDashboard } from '../types/monitor'

export async function addCompetitor(data: {
  url: string; platform: string; market: string; currency: string; name?: string; seller_name?: string; price?: number
}) {
  const res = await client.post<ApiResponse<any>>('/monitor/competitor', data)
  return res.data
}

export async function getMonitorDashboard(params?: { platform?: string }) {
  const res = await client.get<ApiResponse<CompetitorDashboard>>('/monitor/dashboard', { params })
  return res.data
}

export async function setAlertRule(data: { competitor_id: string; condition: string; threshold: number }) {
  const res = await client.post<ApiResponse<any>>('/monitor/alert-rules', data)
  return res.data
}
