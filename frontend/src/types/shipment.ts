export interface Shipment {
  id: string
  order_id: string
  tracking_number?: string | null
  carrier?: string | null
  shipping_method?: string | null
  status: string
  actual_weight_g?: number | null
  volumetric_weight_g?: number | null
  shipping_cost?: number | null
  origin_address?: ShipmentAddress | null
  destination_address?: ShipmentAddress | null
  estimated_delivery_date?: string | null
  actual_delivery_date?: string | null
  tracking_events?: TrackingEvent[] | null
  created_at?: string | null
}

export interface ShipmentAddress {
  market?: string
  country?: string
  city?: string
  address?: string
}

export interface TrackingEvent {
  timestamp: string
  location: string
  status: string
  description: string
}
