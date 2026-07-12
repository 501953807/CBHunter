import client from './client'
import type { ApiResponse } from '../types/common'
import type { ManualOrderCreate, OrderListRow, OrderDetail } from '../types/order'

export interface OrderListParams {
  status?: string
  platform?: string
  platform_account_id?: string
  search?: string
  page?: number
  page_size?: number
}

export async function getOrders(params?: OrderListParams) {
  const res = await client.get<ApiResponse<OrderListRow[]>>('/orders', { params })
  return res.data
}

export async function getOrder(id: string) {
  const res = await client.get<ApiResponse<OrderDetail>>(`/orders/${id}`)
  return res.data
}

export async function updateOrderStatus(id: string, status: string) {
  const res = await client.put<ApiResponse<OrderDetail>>(`/orders/${id}/status`, { status })
  return res.data
}

export async function updateOrderNotes(id: string, notes: string) {
  const res = await client.post<ApiResponse<{ notes: string }>>(`/orders/${id}/notes`, { notes })
  return res.data
}

export async function createManualOrder(data: ManualOrderCreate) {
  const res = await client.post<ApiResponse<OrderDetail>>('/orders/manual', data)
  return res.data
}
