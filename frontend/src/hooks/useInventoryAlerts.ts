import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  checkInventory,
  getAlertLogs,
  acknowledgeAlert,
  clearAlert,
  getAlertStats,
  getInventoryRiskWorkbench,
  createInventorySlowMovingOperationAction,
} from '../api/inventoryAlerts'
import { labelBusinessCode } from '../utils/businessLabels'

export function useAlertRules() {
  return useQuery({
    queryKey: ['inventory-alert-rules'],
    queryFn: () => getAlertRules(),
    refetchInterval: 60_000,
  })
}

export function useCreateAlertRule() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-rules'] })
      toast.addToast('success', '预警规则已创建')
    },
    onError: () => toast.addToast('error', '创建失败'),
  })
}

export function useUpdateAlertRule() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<any>) => updateAlertRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-rules'] })
      toast.addToast('success', '规则已更新')
    },
    onError: () => toast.addToast('error', '更新失败'),
  })
}

export function useDeleteAlertRule() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-rules'] })
      toast.addToast('success', '规则已删除')
    },
    onError: () => toast.addToast('error', '删除失败'),
  })
}

export function useCheckInventory() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: checkInventory,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-alert-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-risk-workbench'] })
      if (d.data?.data_gaps?.length) {
        toast.addToast('warning', `库存扫描缺少数据：${d.data.data_gaps.map(labelBusinessCode).join('、')}`)
      } else {
        toast.addToast('success', `扫描完成，发现 ${d.data?.new_alerts ?? 0} 条新预警`)
      }
    },
    onError: () => toast.addToast('error', '扫描失败'),
  })
}

export function useAlertLogs(params?: { status?: string; severity?: string; page?: number; page_size?: number }) {
  return useQuery({
    queryKey: ['inventory-alert-logs', params],
    queryFn: () => getAlertLogs(params),
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-alert-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-risk-workbench'] })
      toast.addToast('success', '已确认预警')
    },
    onError: () => toast.addToast('error', '操作失败'),
  })
}

export function useClearAlert() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: clearAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-alert-logs'] })
      qc.invalidateQueries({ queryKey: ['inventory-alert-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-risk-workbench'] })
      toast.addToast('success', '已清除预警')
    },
    onError: () => toast.addToast('error', '操作失败'),
  })
}

export function useAlertStats() {
  return useQuery({
    queryKey: ['inventory-alert-stats'],
    queryFn: () => getAlertStats(),
    refetchInterval: 30_000,
  })
}

export function useInventoryRiskWorkbench() {
  return useQuery({
    queryKey: ['inventory-risk-workbench'],
    queryFn: () => getInventoryRiskWorkbench(),
    refetchInterval: 30_000,
  })
}

export function useCreateInventorySlowMovingOperationAction() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createInventorySlowMovingOperationAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-risk-workbench'] })
      qc.invalidateQueries({ queryKey: ['operation-records'] })
      toast.addToast('success', '已生成库存风险运营台账动作')
    },
    onError: () => toast.addToast('error', '生成运营台账动作失败'),
  })
}
