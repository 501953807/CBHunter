export interface Shipment {
  id: string
  order_id: string
  platform_account_id?: string | null
  platform?: string | null
  platform_account_name?: string | null
  order_number?: string | null
  order_status?: string | null
  buyer_name?: string | null
  fulfillment_deadline_at?: string | null
  fulfillment_exception?: {
    status?: string
    severity?: string
    reasons?: string[]
    deadline_at?: string | null
    data_gaps?: string[]
  } | null
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
