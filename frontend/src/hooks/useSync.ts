import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSyncStatus, triggerSync, triggerProductSync, getSyncLogs } from '../api/sync'
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
      qc.invalidateQueries({ queryKey: ['order'] })
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

export function useTriggerProductSync() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (platformAccountId?: string) => triggerProductSync(platformAccountId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sync-status'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory-risk-workbench'] })
      toast.addToast('success', '平台商品库存同步已触发')
    },
    onError: (error: any) => {
      logger.error('Product sync failed from inventory risk workbench', error)
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : detail?.message
      toast.addToast('warning', `平台商品同步未完成：${message || '请先补齐平台商品 Open API 与店铺授权'}`)
    },
  })
}

export function useSyncLogs(platformAccountId?: string, page = 1) {
  return useQuery({
    queryKey: ['sync-logs', platformAccountId, page],
    queryFn: () => getSyncLogs(platformAccountId, page),
  })
}
