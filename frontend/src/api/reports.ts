import client from './client'
import type { ApiResponse } from '../types/common'
import type { Report, AnomalyItem, ReportSubscription } from '../types/reports'

export async function getDailyReport(date?: string) {
  const res = await client.get<ApiResponse<Report>>('/reports/daily', { params: date ? { date } : {} })
  return res.data
}

export async function getWeeklyReport(weekStart?: string) {
  const res = await client.get<ApiResponse<Report>>('/reports/weekly', { params: weekStart ? { week_start: weekStart } : {} })
  return res.data
}

export async function getMonthlyReport(month?: string) {
  const res = await client.get<ApiResponse<Report>>('/reports/monthly', { params: month ? { month } : {} })
  return res.data
}

export async function detectAnomalies() {
  const res = await client.post<ApiResponse<{ detected_at: string; anomalies: AnomalyItem[]; total: number }>>('/reports/anomaly/detect')
  return res.data
}

export async function getReportSummary() {
  const res = await client.get<ApiResponse<{ today: any }>>('/reports/summary')
  return res.data
}

export async function getSubscriptions() {
  const res = await client.get<ApiResponse<ReportSubscription[]>>('/reports/subscriptions')
  return res.data
}

export async function createSubscription(data: { channel: 'in_app'; frequency: string }) {
  const res = await client.post<ApiResponse<ReportSubscription>>('/reports/schedule', data)
  return res.data
}

export async function deleteSubscription(subId: string) {
  const res = await client.delete<ApiResponse<{ deleted: boolean }>>(`/reports/subscriptions/${subId}`)
  return res.data
}
