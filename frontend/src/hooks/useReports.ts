import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/ui/Toast'
import {
  getDailyReport, getWeeklyReport, getMonthlyReport,
  detectAnomalies,
  getSubscriptions, createSubscription, deleteSubscription,
} from '../api/reports'

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => getDailyReport(date),
  })
}

export function useWeeklyReport(weekStart?: string) {
  return useQuery({
    queryKey: ['report-weekly', weekStart],
    queryFn: () => getWeeklyReport(weekStart),
  })
}

export function useMonthlyReport(month?: string) {
  return useQuery({
    queryKey: ['report-monthly', month],
    queryFn: () => getMonthlyReport(month),
  })
}

export function useDetectAnomalies() {
  const toast = useToast()
  return useMutation({
    mutationFn: detectAnomalies,
    onSuccess: (d) => {
      toast.addToast('success', `检测完成，发现 ${d.data?.total ?? 0} 条异常`)
    },
    onError: () => toast.addToast('error', '检测失败'),
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['report-subscriptions'],
    queryFn: () => getSubscriptions(),
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-subscriptions'] })
      toast.addToast('success', '订阅成功')
    },
    onError: () => toast.addToast('error', '订阅失败'),
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-subscriptions'] })
      toast.addToast('success', '已取消订阅')
    },
    onError: () => toast.addToast('error', '操作失败'),
  })
}
