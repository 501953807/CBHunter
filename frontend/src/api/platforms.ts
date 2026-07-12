import client from './client'
import type { ApiResponse, PlatformAccount } from '../types/common'

export interface PlatformIntegrationStatus {
  account_id: string
  platform: string
  account_name: string
  account_active: boolean
  credentials_stored: boolean
  implementation_status: 'implemented' | 'not_implemented' | 'unsupported'
  connection_status: 'disabled' | 'unsupported' | 'not_implemented' | 'credentials_missing' | 'authorization_required' | 'authorization_expired' | 'scope_insufficient' | 'unverified'
  authorization_status?: 'not_authorized' | 'expired' | 'scope_insufficient' | 'authorized'
  authorization?: {
    status?: string
    access_token_stored?: boolean
    refresh_token_stored?: boolean
    token_expires_at?: string | null
    token_scopes?: string[]
    required_scopes?: string[]
    missing_scopes?: string[]
  }
  sync_ready: boolean
  operations: Record<string, boolean>
  operation_details: { id: string; label: string; status: 'implemented' | 'not_implemented' }[]
  sync_state?: Record<string, {
    status?: string
    last_attempt_at?: string | null
    last_completed_at?: string | null
    records_processed?: number
    records_created?: number
    records_updated?: number
    records_failed?: number
    error_message?: string | null
  }>
  last_product_sync_status?: string | null
  last_product_sync_at?: string | null
  last_order_sync_status?: string | null
  last_order_sync_at?: string | null
  required_inputs: string[]
  next_action?: string | null
  message: string
}

export async function getPlatforms() {
  const res = await client.get<ApiResponse<PlatformAccount[]>>('/platforms')
  return res.data
}

export async function getPlatformStatuses() {
  const res = await client.get<ApiResponse<PlatformIntegrationStatus[]>>('/platforms/status')
  return res.data
}

export async function createPlatform(data: {
  platform: string
  account_name: string
  shop_id?: string
  api_key?: string
  api_secret?: string
}) {
  const res = await client.post<ApiResponse<PlatformAccount>>('/platforms', data)
  return res.data
}

export async function updatePlatformAuthorization(id: string, data: {
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  token_scopes?: string[]
}) {
  const res = await client.put<ApiResponse<PlatformAccount>>(`/platforms/${id}/authorization`, data)
  return res.data
}

export async function deletePlatform(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/platforms/${id}`)
  return res.data
}
