import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createPlatform, deletePlatform, getPlatforms, getPlatformStatuses, updatePlatformAuthorization } from '../api/platforms'
import { useToast } from '../components/ui/Toast'
import { logger } from '../utils/logger'

export function usePlatforms() {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: getPlatforms,
  })
}

export function usePlatformStatuses() {
  return useQuery({
    queryKey: ['platform-statuses'],
    queryFn: getPlatformStatuses,
  })
}

export function useCreatePlatform() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createPlatform,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platforms'] })
      qc.invalidateQueries({ queryKey: ['platform-statuses'] })
      toast.addToast('success', '平台账号配置已保存')
    },
    onError: (error) => {
      logger.error('Failed to save platform account', error)
      toast.addToast('error', '保存平台账号配置失败')
    },
  })
}

export function useUpdatePlatformAuthorization() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePlatformAuthorization>[1] }) =>
      updatePlatformAuthorization(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platforms'] })
      qc.invalidateQueries({ queryKey: ['platform-statuses'] })
      toast.addToast('success', '店铺授权令牌已保存')
    },
    onError: (error) => {
      logger.error('Failed to save platform authorization', error)
      toast.addToast('error', '保存店铺授权令牌失败')
    },
  })
}

export function useDeletePlatform() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deletePlatform,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platforms'] })
      qc.invalidateQueries({ queryKey: ['platform-statuses'] })
      toast.addToast('success', '平台账号配置已删除')
    },
    onError: (error) => {
      logger.error('Failed to delete platform account', error)
      toast.addToast('error', '删除平台账号配置失败')
    },
  })
}
