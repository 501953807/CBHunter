import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  checkAlerts,
} from '../api/notifications'

export function useNotifications(params?: { type?: string; unread_only?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => getNotifications(params),
    refetchInterval: 30_000,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', { unread_only: true, limit: 1 }],
    queryFn: () => getNotifications({ unread_only: true, limit: 1 }),
    refetchInterval: 30_000,
    select: (d) => d.data?.unread_count ?? 0,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.addToast('success', `已标记 ${d.data?.marked ?? 0} 条为已读`)
    },
    onError: () => toast.addToast('error', '操作失败'),
  })
}

export function useCheckAlerts() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: checkAlerts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.addToast('success', '预警检查完成')
    },
    onError: () => toast.addToast('error', '预警检查失败'),
  })
}
