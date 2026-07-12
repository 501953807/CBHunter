import client from './client'
import type { ApiResponse } from '../types/common'
import type { Shipment } from '../types/shipment'

export interface ShipmentListParams {
  status?: string
  carrier?: string
  page?: number
  page_size?: number
}

export interface ShipmentCreateRequest {
  order_id: string
  carrier: string
  shipping_method?: string
  tracking_number?: string
  status?: string
  actual_weight_g?: number
  volumetric_weight_g?: number
  shipping_cost?: number
  origin_address?: Record<string, string>
  destination_address?: Record<string, string>
  estimated_delivery_date?: string
}

export async function getShipments(params?: ShipmentListParams) {
  const res = await client.get<ApiResponse<Shipment[]>>('/shipments', { params })
  return res.data
}

export async function getShipment(id: string) {
  const res = await client.get<ApiResponse<Shipment>>(`/shipments/${id}`)
  return res.data
}

export async function createShipment(data: ShipmentCreateRequest) {
  const res = await client.post<ApiResponse<Shipment>>('/shipments', data)
  return res.data
}

export async function updateShipment(id: string, data: Partial<ShipmentCreateRequest>) {
  const res = await client.put<ApiResponse<Shipment>>(`/shipments/${id}`, data)
  return res.data
}

export async function batchCreateShipments(data: { order_ids: string[]; carrier: string; shipping_method?: string }) {
  const res = await client.post<ApiResponse<Shipment[]>>('/shipments/batch', data)
  return res.data
}
