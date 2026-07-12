import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getShipments, getShipment, createShipment, updateShipment } from '../api/shipments'
import { useToast } from '../components/ui/Toast'
import type { ShipmentListParams } from '../api/shipments'

export function useShipmentList(params?: ShipmentListParams) {
  return useQuery({
    queryKey: ['shipments', params],
    queryFn: () => getShipments(params),
  })
}

export function useShipment(id: string) {
  return useQuery({
    queryKey: ['shipment', id],
    queryFn: () => getShipment(id),
    enabled: !!id,
  })
}

export function useCreateShipment() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: createShipment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      toast.addToast('success', '物流创建成功')
    },
    onError: () => toast.addToast('error', '创建物流失败'),
  })
}

export function useUpdateShipment() {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateShipment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipments'] })
      toast.addToast('success', '物流更新成功')
    },
    onError: () => toast.addToast('error', '更新物流失败'),
  })
}
