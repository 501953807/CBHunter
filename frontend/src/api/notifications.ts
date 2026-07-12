import client from './client'
import type { ApiResponse } from '../types/common'
import type { NotificationListResponse } from '../types/notification'

export async function getNotifications(params?: {
  type?: string
  unread_only?: boolean
  limit?: number
}) {
  const res = await client.get<ApiResponse<NotificationListResponse>>('/notifications', { params })
  return res.data
}

export async function markNotificationRead(id: string) {
  const res = await client.put<ApiResponse<{ status: string }>>(`/notifications/${id}/read`)
  return res.data
}

export async function markAllNotificationsRead() {
  const res = await client.put<ApiResponse<{ status: string; marked: number }>>('/notifications/read-all')
  return res.data
}

export async function checkAlerts() {
  const res = await client.post<ApiResponse<{ alerts_checked: boolean; unread_count: number }>>('/notifications/check-alerts')
  return res.data
}
