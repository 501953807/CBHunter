import client from './client'
import type { ApiResponse } from '../types/common'
import type { NetworkStatus } from '../types/sourcing'

export async function getNetworkStatus() {
  const res = await client.get<ApiResponse<NetworkStatus>>('/system/network')
  return res.data
}

export async function refreshNetwork() {
  const res = await client.post<ApiResponse<{ status: string; overseas: boolean }>>('/system/network/refresh')
  return res.data
}
