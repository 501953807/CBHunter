import client from './client'
import type { ApiResponse } from '../types/common'
import type { InventoryAlertRule, InventoryAlertLog, AlertStats } from '../types/inventoryAlert'

export type InventoryCheckResult = {
  checked: boolean
  new_alerts: number
  rules_checked: number
  rules_skipped_no_confirmed_stock: number
  status?: 'ready' | 'data_required'
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
}

export async function getAlertRules() {
  const res = await client.get<ApiResponse<InventoryAlertRule[]>>('/inventory-alerts/rules')
  return res.data
}

export async function createAlertRule(data: {
  product_id: string; sku: string; product_name: string
  safety_stock: number; severity: string
}) {
  const res = await client.post<ApiResponse<InventoryAlertRule>>('/inventory-alerts/rules', data)
  return res.data
}

export async function updateAlertRule(ruleId: string, data: Partial<InventoryAlertRule>) {
  const res = await client.put<ApiResponse<InventoryAlertRule>>(`/inventory-alerts/rules/${ruleId}`, data)
  return res.data
}

export async function deleteAlertRule(ruleId: string) {
  const res = await client.delete<ApiResponse<{ deleted: boolean }>>(`/inventory-alerts/rules/${ruleId}`)
  return res.data
}

export async function checkInventory() {
  const res = await client.post<ApiResponse<InventoryCheckResult>>('/inventory-alerts/check')
  return res.data
}

export async function getAlertLogs(params?: { status?: string; severity?: string; page?: number; page_size?: number }) {
  const res = await client.get<ApiResponse<InventoryAlertLog[]>>('/inventory-alerts/logs', { params })
  return res.data
}

export async function acknowledgeAlert(alertId: string) {
  const res = await client.put<ApiResponse<InventoryAlertLog>>(`/inventory-alerts/logs/${alertId}/acknowledge`)
  return res.data
}

export async function clearAlert(alertId: string) {
  const res = await client.put<ApiResponse<InventoryAlertLog>>(`/inventory-alerts/logs/${alertId}/clear`)
  return res.data
}

export async function getAlertStats() {
  const res = await client.get<ApiResponse<AlertStats>>('/inventory-alerts/stats')
  return res.data
}
