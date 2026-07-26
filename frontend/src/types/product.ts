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

export interface ProductObjectModelSnapshot {
  status: string
  product: { id: string; sku: string; name: string }
  summary: {
    base_version_count: number
    listing_instance_count: number
    sku_variant_count: number
    field_validation_count: number
    missing_required_field_count: number
  }
  base_versions: Array<{ id: string; version_no: number; title: string; status: string }>
  listing_instances: Array<{
    id: string
    platform_account_id: string
    platform?: string | null
    store_name?: string | null
    market?: string | null
    platform_product_id?: string | null
    title: string
    status: string
    price?: number | null
    stock?: number | null
  }>
  sku_variants: Array<{
    scope: string
    platform_listing_id?: string | null
    merchant_sku: string
    platform_sku?: string | null
    option_1_value?: string | null
    option_2_value?: string | null
    price?: number | null
    stock?: number | null
  }>
  field_validations: Array<{
    platform: string
    market?: string | null
    field_key: string
    requirement_level: string
    state: string
    issue_code?: string | null
  }>
  rules: Record<string, boolean>
  data_gaps: string[]
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
