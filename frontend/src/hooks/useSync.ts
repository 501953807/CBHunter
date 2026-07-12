import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSyncStatus, triggerSync, getSyncLogs } from '../api/sync'
import { useToast } from '../components/ui/Toast'
import { logger } from '../utils/logger'

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: 60000, // Refetch every minute
  })
}

export function useTriggerSync() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (platformAccountId?: string) => triggerSync(platformAccountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync-status'] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.addToast('success', '同步完成')
    },
    onError: (error: any) => {
      logger.error('Platform sync failed', error)
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : detail?.message
      toast.addToast('error', message || '同步失败')
    },
  })
}

export function useSyncLogs(platformAccountId?: string, page = 1) {
  return useQuery({
    queryKey: ['sync-logs', platformAccountId, page],
    queryFn: () => getSyncLogs(platformAccountId, page),
  })
}
