export interface Notification {
  id: string
  type: 'alert' | 'report' | 'system'
  level: 'info' | 'warning' | 'critical'
  title: string
  message?: string | null
  link?: string | null
  read: boolean
  created_at: string
}

export interface NotificationListResponse {
  notifications: Notification[]
  unread_count: number
  total: number
}
