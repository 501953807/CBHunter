import client from './client'
import type { ApiResponse } from '../types/common'

export async function createRealtimeTicket() {
  const res = await client.post<ApiResponse<{ ticket: string; expires_in: number }>>('/realtime/ticket')
  return res.data
}
