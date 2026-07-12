import client from './client'
import type { ApiResponse } from '../types/common'
import type { AuditLogEntry } from '../types/audit'

export interface AuditLogParams {
  user_id?: string
  action?: string
  resource_type?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export async function getAuditLogs(params?: AuditLogParams) {
  const res = await client.get<ApiResponse<AuditLogEntry[]>>('/audit-logs', { params })
  return res.data
}
