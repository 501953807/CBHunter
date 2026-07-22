import client from './client'
import type { ApiResponse } from '../types/common'
import type { MediaReadiness } from './content'

export interface BatchPreviewRequest {
  sourcing_item_ids: string[]
  product_ids?: string[]
  platforms: string[]
  markets: string[]
  platform_account_ids?: string[]
  pricing_mode: 'cost_based' | 'selling_based'
  target_profit_pct: number
}

export interface PlatformListingRequirements {
  required_attributes?: string[]
  media?: string[]
  content?: string[]
  compliance?: string[]
  attribute_values?: Record<string, unknown>
  field_groups?: unknown[]
  object_model?: string[]
  evidence_source?: string
  evidence?: {
    platform?: string
    source_page?: string
    observed_at?: string
    evidence_scope?: string
    confidence?: 'confirmed' | 'partial'
    needs_recheck?: string[]
    summary?: string
  }
}

export interface ListingStoreOverrideSummary {
  schema?: string
  store_id?: string | null
  store_label?: string | null
  title?: string | null
  image_count?: number
  sku_count?: number
  has_platform_attributes?: boolean
  has_logistics?: boolean
  has_compliance?: boolean
  override_boundary?: string | null
}

export interface ListingMasterStatus {
  ready: boolean
  label: string
  detail?: string
  source?: string
  confirmed_required?: number
  confirmed_count?: number
  missing?: string[]
}

export interface ListingInstanceMatrixItem {
  id: string
  product_id: string
  platform: string
  store: {
    id: string
    account_name: string
    shop_id?: string | null
    market?: string | null
  }
  platform_product_id?: string | null
  title: string
  description?: string | null
  price: number
  stock: number
  status: string
  images: string[]
  variations: Array<Record<string, unknown>>
  video_url?: string | null
  source_url?: string | null
  shipping_config?: Record<string, unknown>
  publish_plan?: Record<string, unknown>
  platform_requirements?: PlatformListingRequirements
  listing_overrides: Record<string, unknown>
  snapshot: Record<string, unknown>
  performance: Record<string, unknown>
  platform_publish_status?: string | null
  platform_api_status?: string | null
  updated_at?: string | null
}

export interface ProductListingMatrix {
  product_master: {
    id: string
    sku: string
    name: string
    brand?: string | null
    category_id?: string | null
    cost_price?: number | null
    weight_g?: number | null
    dimensions?: Record<string, unknown> | null
    images: string[]
    source_offer_id?: string | null
    selection_refs?: unknown[]
  }
  base_version: Record<string, unknown>
  listing_instances: ListingInstanceMatrixItem[]
  rules: {
    store_override_isolation: boolean
    master_update_requires_explicit_action: boolean
    platform_sync_updates_listing_only: boolean
  }
}

export interface ListingWorkbenchItem {
  id: string
  key: string
  work_item_id: string
  object_refs: { type: string; id: string; label: string }[]
  source_type: 'sourcing'
  name: string
  cost_price: number | null
  selling_price_local: number | null
  platform: string
  platform_account_id?: string | null
  store?: {
    id: string
    platform: string
    account_name: string
    shop_id?: string | null
    market?: string | null
  } | null
  market: string
  image_url?: string | null
  media_readiness?: MediaReadiness
  platform_requirements?: PlatformListingRequirements
  listing_master_status?: ListingMasterStatus
  listing_store_override?: ListingStoreOverrideSummary
  pricing_confirmation?: Record<string, unknown>
  lifecycle_status: string
  lifecycle_label: string
  evidence_completeness: Record<string, 'present' | 'missing' | 'stale' | 'low_confidence'>
  evidence_summary: {
    total: number
    present: number
    missing: number
    stale: number
    low_confidence: number
  }
  data_gaps: string[]
}

export interface ListingWorkbench {
  status: string
  metrics: { total: number }
  items: ListingWorkbenchItem[]
  data_gaps: string[]
  evidence_window: string
  confidence_reason: string
}

export interface BatchListingDraft {
  source_type?: 'sourcing' | 'product'
  source_product_id?: string | null
  sourcing_item_id: string | null
  product_name: string | null
  product_name_cn: string | null
  category: string | null
  platform: string
  platform_account_id?: string | null
  store?: {
    id: string
    platform: string
    account_name: string
    shop_id?: string | null
    market?: string | null
  } | null
  market: string
  market_label: string
  selling_price: number | null
  source_price_rmb: number | null
  commission_pct: number | null
  transaction_fee_pct: number | null
  tech_service_pct: number | null
  total_fee_pct: number | null
  estimated_profit_margin: number | null
  images: string | string[]
  sku_plan?: {
    master_sku?: string | null
    variant_model?: string | null
    variants?: Array<Record<string, unknown>>
  }
  media_assets?: {
    main_image?: string | null
    images?: string[]
    videos?: string[]
    media_readiness?: MediaReadiness
    image_edit_status?: string
    video_edit_status?: string
  }
  logistics?: {
    weight_g?: number | null
    dimensions?: Record<string, unknown>
    preparation_days?: number | null
    shipping_template_id?: string | null
    warehouse_policy?: string | null
  }
  compliance?: {
    condition?: string
    certifications?: string[]
    restricted_check_status?: string
    [key: string]: unknown
  }
  validation_checks?: Array<{
    code: string
    label: string
    state: 'pass' | 'warning' | 'block'
    message: string
  }>
  template_title: string
  template_description: string
  platform_requirements?: PlatformListingRequirements
  listing_master_status?: ListingMasterStatus
  listing_store_override?: ListingStoreOverrideSummary
  field_sources?: Record<string, string>
  override_boundary?: string
  template_missing: boolean
  fee_missing: boolean
  status?: 'ready' | 'configuration_required' | 'data_required'
  data_gaps?: string[]
  evidence_window?: string
  confidence_reason?: string
  publishable: boolean
  blocking_reasons: string[]
  confirmed?: boolean
}

export interface BatchPreviewSummary {
  total_products: number
  total_listings: number
  platforms: string[]
  markets: string[]
  avg_estimated_margin_pct: number | null
}

export interface BatchPreviewResponse {
  drafts: BatchListingDraft[]
  summary: BatchPreviewSummary
}

export interface BatchPublishPlan {
  mode: 'draft_only' | 'immediate' | 'scheduled'
  scheduled_at?: string
}

export interface BatchPublishRequest {
  drafts: BatchListingDraft[]
  publish_plan?: BatchPublishPlan
}

export interface BatchPublishItemResult extends BatchListingDraft {
  publish_status: 'draft' | 'skipped'
  plan_status?: 'planned'
  platform_publish_status?: 'not_attempted'
  publish_plan?: BatchPublishPlan & { status?: string; platform_api_status?: string }
  error?: string
  product_id?: string
  listing_id?: string
  drafted_at?: string
}

export interface BatchPublishResponse {
  published: number
  drafts_created: number
  skipped: number
  status: string
  publish_plan?: BatchPublishPlan
  platform_publish_status?: 'not_attempted'
  results: BatchPublishItemResult[]
}

export interface ListingAssistResponse {
  status: string
  assist_type: string
  patch: Partial<BatchListingDraft>
  candidate_text?: string
  provider: string
  confidence: string
  data_gaps?: string[]
  does_not_save: boolean
  note?: string
}

export async function batchPreviewListings(data: BatchPreviewRequest) {
  const res = await client.post<ApiResponse<BatchPreviewResponse>>('/listing/batch-preview', data)
  return res.data
}

export async function getListingWorkbench() {
  const res = await client.get<ApiResponse<ListingWorkbench>>('/listing/workbench')
  return res.data
}

export async function batchPublishListings(data: BatchPublishRequest) {
  const res = await client.post<ApiResponse<BatchPublishResponse>>('/listing/batch-publish', data)
  return res.data
}

export async function getProductListingMatrix(productId: string) {
  const res = await client.get<ApiResponse<ProductListingMatrix>>(`/listing/products/${productId}/matrix`)
  return res.data
}

export async function updateListingOverrides(listingId: string, overrides: Record<string, unknown>) {
  const res = await client.patch<ApiResponse<ListingInstanceMatrixItem>>(`/listing/instances/${listingId}/overrides`, { overrides })
  return res.data
}

export async function promoteListingToBaseVersion(listingId: string) {
  const res = await client.post<ApiResponse<ProductListingMatrix>>(`/listing/instances/${listingId}/promote-base-version`)
  return res.data
}

export async function generateListingDraftAssist(data: BatchListingDraft & { assist_type: string; preferred_providers?: string[] }) {
  const res = await client.post<ApiResponse<ListingAssistResponse>>('/listing/drafts/assist', data)
  return res.data
}
