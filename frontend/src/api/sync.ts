import client from './client'
import type { ApiResponse } from '../types/common'

export interface SyncStatusItem {
  account_id: string
  platform: string
  account_name: string
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  records_processed: number
}

export interface SyncResult {
  account_id: string
  sync_log_id?: string
  status: string
  records_processed: number
  records_created?: number
  records_updated?: number
  records_failed?: number
  error_message?: string | null
  source_refs?: Array<{ type: string; id?: string | null }>
  evidence_window?: string | null
  confidence_reason?: string | null
  data_gaps?: string[]
}

export interface SyncBlockDetail {
  message?: string
  data_gaps?: string[]
  next_action?: string | null
  operation_details?: Array<{ id: string; label: string; status: 'implemented' | 'not_implemented' }>
  connector?: {
    account_id: string
    platform: string
    account_name: string
    connection_status: string
    message: string
    next_action?: string | null
    operation_details?: Array<{ id: string; label: string; status: 'implemented' | 'not_implemented' }>
  }
}

export interface SyncLogItem {
  id: string
  platform_account_id: string
  sync_type: string
  status: string
  started_at: string | null
  completed_at: string | null
  records_processed: number
  records_created: number
  records_updated: number
  records_failed: number
  error_message: string | null
}

export async function getSyncStatus() {
  const res = await client.get<ApiResponse<SyncStatusItem[]>>('/sync/status')
  return res.data
}

export async function triggerSync(platformAccountId?: string) {
  const params = platformAccountId ? { platform_account_id: platformAccountId } : {}
  const res = await client.post<ApiResponse<SyncResult[] | SyncResult>>('/sync/trigger', null, { params })
  return res.data
}

export async function triggerProductSync(platformAccountId?: string) {
  const params = platformAccountId ? { platform_account_id: platformAccountId } : {}
  const res = await client.post<ApiResponse<SyncResult[] | SyncResult>>('/sync/products/trigger', null, { params })
  return res.data
}

export async function getSyncLogs(platformAccountId?: string, page = 1) {
  const params: Record<string, unknown> = { page }
  if (platformAccountId) params.platform_account_id = platformAccountId
  const res = await client.get<ApiResponse<SyncLogItem[]>>('/sync/logs', { params })
  return res.data
}
