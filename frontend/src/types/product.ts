export interface Product {
  id: string
  sku: string
  name: string
  description?: string | null
  brand?: string | null
  category_id?: string | null
  cost_price?: number | null
  weight_g?: number | null
  dimensions?: Record<string, unknown> | null
  attributes?: Record<string, unknown> | null
  images?: string[] | null
  tags?: string[] | null
  status: string
  notes?: string | null
  data_quality_flags?: string[]
  created_at?: string | null
  updated_at?: string | null
  listings?: ProductListing[]
}

export interface ProductVariant {
  sku: string
  name: string
  stock: number
  price?: number
}

export interface ProductCompliance {
  origin_country?: string
  material?: string
  safety_standard?: string
  certification_number?: string
  restricted_goods_note?: string
}

export interface ProductListing {
  id: string
  platform: string
  account_name: string
  title: string
  price: number
  stock: number
  status: string
  listing_url?: string | null
  platform_data?: Record<string, unknown> | null
}

export interface ProductListRow {
  id: string
  sku: string
  name: string
  brand?: string | null
  category_id?: string | null
  cost_price?: number | null
  weight_g?: number | null
  attributes?: Record<string, unknown> | null
  status: string
  images?: string[] | null
  data_quality_flags?: string[]
  created_at?: string | null
  updated_at?: string | null
}

export interface ProductCreateRequest {
  sku?: string
  name: string
  description?: string
  brand?: string
  category_id?: string
  cost_price?: number
  weight_g?: number
  status?: string
  notes?: string
  attributes?: Record<string, unknown>
  images?: string[]
}
