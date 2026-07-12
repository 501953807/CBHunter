import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, getOrder, updateOrderStatus, updateOrderNotes } from '../api/orders'
import { useToast } from '../components/ui/Toast'
import type { OrderListParams } from '../api/orders'

export function useOrderList(params?: OrderListParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => getOrders(params),
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
    enabled: !!id,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.addToast('success', '订单状态更新成功')
    },
    onError: () => toast.addToast('error', '更新订单状态失败'),
  })
}

export function useUpdateOrderNotes() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateOrderNotes(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      toast.addToast('success', '备注保存成功')
    },
    onError: () => toast.addToast('error', '保存备注失败'),
  })
}
