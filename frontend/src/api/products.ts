import client from './client'
import type { ApiResponse } from '../types/common'
import type { Product, ProductListRow, ProductCreateRequest, ProductObjectModelSnapshot } from '../types/product'

export interface ProductListParams {
  status?: string
  category_id?: string
  search?: string
  page?: number
  page_size?: number
}

export interface PlatformStoreProductParams {
  platform?: string
  platform_account_id?: string
  market?: string
  status?: string
  search?: string
  page?: number
  page_size?: number
}

export interface PlatformStoreProduct {
  id: string
  platform: string
  platform_product_id?: string | null
  title: string
  status: string
  price: number
  stock: number
  image_count: number
  images: string[]
  media_readiness?: {
    captured_image_count?: number
    missing_image_count?: number
    min_platform_images?: number
    recommended_platform_images?: number
    gaps?: string[]
    source?: string
  }
  inventory_alert_summary?: {
    status: string
    label: string
    severity: 'critical' | 'warning' | 'info' | 'success' | string
    current_stock: number
    safety_stock?: number | null
    matched_rule_count: number
    open_alert_count: number
    below_safety_stock: boolean
    skus: string[]
    data_gaps: string[]
  }
  store_override_summary?: {
    relation_label: string
    isolation_note: string
    title_overridden: boolean
    description_overridden: boolean
    image_count: number
    master_image_count: number
    images_overridden: boolean
    variation_count: number
    price_stock_overridden: boolean
    platform_attribute_count: number
    logistics_configured: boolean
  }
  publish_plan_summary?: {
    mode?: string | null
    plan_status?: string | null
    platform_api_status?: string | null
    platform_publish_status?: string | null
    receipt_status?: string | null
    retryable?: boolean
    next_action?: string | null
    is_local_draft?: boolean
    queue_status?: string
    official_publish_writeback?: {
      schema?: string
      listing_id?: string | null
      platform_product_id?: string | null
      platform_api_status?: string | null
      platform_publish_status?: string | null
      official_response_field_count?: number
      written_field_count?: number
      boundary_note?: string
      next_action?: string | null
    } | null
  }
  sync_receipt_summary?: {
    status?: string | null
    sync_log_id?: string | null
    official_product_id?: string | null
    platform?: string | null
    shop_id?: string | null
    last_attempt_at?: string | null
    last_completed_at?: string | null
    records_processed?: number
    records_failed?: number
    error_message?: string | null
    error_details?: Array<Record<string, unknown>>
    raw_field_count?: number
    source?: string | null
    next_action?: string | null
  }
  field_writeback_summary?: {
    scope?: string
    written_field_count?: number
    attribute_field_count?: number
    raw_field_count?: number
    missing_core_fields?: string[]
    boundary_note?: string
  }
  variation_count: number
  last_synced_at?: string | null
  source: string
  store: {
    id: string
    platform: string
    account_name: string
    shop_id?: string | null
    market?: string | null
    product_sync_status?: string | null
    product_sync_at?: string | null
  }
  product_master: { id: string; sku: string; name: string; image_count: number }
}

export interface PlatformStoreProductFilterSummary {
  scope?: 'current_filter' | string
  total_listing_count?: number
  store_count?: number
  market_count?: number
  platform_count?: number
  platforms?: string[]
  synced_count?: number
  local_draft_count?: number
  media_gap_count?: number
  publish_queue_count?: number
  inventory_risk_count?: number
  variation_count?: number
}

export interface ProductImageAssetResult {
  product_id: string
  image_url: string
  asset: {
    id: string
    asset_type: string
    original_name?: string | null
    mime_type: string
    size_bytes: number
    width?: number | null
    height?: number | null
    operation: string
    status: string
    extra: Record<string, unknown>
  }
}

export async function getProducts(params?: ProductListParams) {
  const res = await client.get<ApiResponse<ProductListRow[]>>('/products', { params })
  return res.data
}

export async function getPlatformStoreProducts(params?: PlatformStoreProductParams) {
  const res = await client.get<ApiResponse<PlatformStoreProduct[]>>('/products/platform-listings', { params })
  return res.data
}

export async function getProduct(id: string) {
  const res = await client.get<ApiResponse<Product>>(`/products/${id}`)
  return res.data
}

export async function getProductObjectModel(id: string) {
  const res = await client.get<ApiResponse<ProductObjectModelSnapshot>>(`/products/${id}/object-model`)
  return res.data
}

export async function createProduct(data: ProductCreateRequest) {
  const res = await client.post<ApiResponse<Product>>('/products', data)
  return res.data
}

export async function updateProduct(id: string, data: Partial<ProductCreateRequest>) {
  const res = await client.put<ApiResponse<Product>>(`/products/${id}`, data)
  return res.data
}

export async function deleteProduct(id: string) {
  const res = await client.delete<ApiResponse<{ message: string }>>(`/products/${id}`)
  return res.data
}

export async function exportProducts(format: 'csv' | 'xlsx') {
  const res = await client.get<Blob>('/products/export', { params: { format }, responseType: 'blob' })
  return res.data
}

export async function importProducts(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await client.post<ApiResponse<{ created_count: number; failed_count: number; errors: { row: number; error: string }[] }>>('/products/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function uploadProductImage(productId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await client.post<ApiResponse<ProductImageAssetResult>>(`/products/${productId}/images/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function importProductImageUrl(productId: string, imageUrl: string) {
  const res = await client.post<ApiResponse<ProductImageAssetResult>>(`/products/${productId}/images/import-url`, { image_url: imageUrl })
  return res.data
}

export async function seedSampleProducts() {
  const res = await client.post<ApiResponse<{
    created_count: number
    skipped_count: number
    sample_count: number
    sample_pack: string
    product_ids: string[]
    skipped_product_ids: string[]
    created_counts: Record<string, number>
  }>>('/products/sample-data')
  return res.data
}

export async function batchUpdatePrice(data: { product_ids: string[]; operation: string; value: number }) {
  const res = await client.post<ApiResponse<{ updated_count: number }>>('/products/batch/price', data)
  return res.data
}

export async function batchUpdateStock(data: { product_ids: string[]; operation: string; value: number }) {
  const res = await client.post<ApiResponse<{ updated_count: number }>>('/products/batch/stock', data)
  return res.data
}

export interface ProductClassData {
  status: 'ready' | 'data_required'
  total_products: number
  total_revenue: number
  revenue_status: 'complete' | 'partial'
  missing_metric_count: number
  distribution: Record<string, { count: number; revenue_share: number }>
  core_products: { name: string; orders: number | null; revenue: number | null }[]
  source_refs: { type: string; id?: string; label?: string }[]
  evidence_window: string
  confidence_reason: string
  data_gaps: string[]
}

export async function getProductClassification() {
  const res = await client.get<ApiResponse<ProductClassData>>('/products/analysis/classification')
  return res.data
}
