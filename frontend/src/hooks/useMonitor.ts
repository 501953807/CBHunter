import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import { addCompetitor, getMonitorDashboard, setAlertRule } from '../api/monitor'
import { deleteCompetitor } from '../api/research'

export function useMonitorDashboard(params?: { platform?: string }) {
  return useQuery({
    queryKey: ['monitor-dashboard', params],
    queryFn: () => getMonitorDashboard(params),
    refetchInterval: 60_000,
  })
}

export function useAddCompetitor() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: addCompetitor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-dashboard'] })
      toast.addToast('success', '竞品已添加')
    },
    onError: () => toast.addToast('error', '添加失败'),
  })
}

export function useRemoveCompetitor() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deleteCompetitor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-dashboard'] })
      toast.addToast('success', '竞品已移除')
    },
    onError: () => toast.addToast('error', '移除失败'),
  })
}

export function useSetAlertRule() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: setAlertRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-dashboard'] })
      toast.addToast('success', '预警规则已设置')
    },
    onError: () => toast.addToast('error', '设置失败'),
  })
}
