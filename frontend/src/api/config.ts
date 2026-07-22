import client from './client'
import type { ApiResponse } from '../types/common'

export interface DictCategory {
  id: string
  label: string
  icon?: string
  keywords?: string[]
}

export interface DictMarket {
  id: string
  label: string
  flag?: string
  currency?: string
  domains?: Record<string, string>
}

export interface DictPlatform {
  id: string
  label: string
  icon?: string
  color?: string
  capabilities?: string[]
  search_url_template?: string
  credential_fields?: DictCredentialField[]
}

export interface DictCredentialField {
  key: 'shop_id' | 'api_key' | 'api_secret'
  label: string
  placeholder: string
  type?: 'password'
}

export interface PlatformProductField {
  key: string
  label: string
  required?: boolean
  placeholder?: string
  evidence_state?: 'observed' | 'needs_category_recheck' | 'needs_edit_page_recheck' | 'needs_api_recheck'
  unified_field_key?: string
  standard_label?: string
  data_type?: string
  country_difference?: string
  platform_field_name?: string
  miaoshou_field_name?: string
}

export interface PlatformProductFieldGroup {
  id: string
  label: string
  help?: string
  fields: PlatformProductField[]
}

export interface PlatformProductFieldSchema {
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
  object_model?: string[]
  groups: PlatformProductFieldGroup[]
}

export type PlatformProductFieldGroups = Record<string, PlatformProductFieldSchema>

export interface UnifiedFieldDictionaryItem {
  order: number
  key: string
  label: string
  data_type: string
  module: string
  is_standard_field: boolean
  country_difference?: string
  remark?: string
  platforms?: Record<string, { field?: string; note?: string }>
}

export interface UnifiedFieldDictionary {
  source?: string
  version?: string
  fields: UnifiedFieldDictionaryItem[]
}

export interface DictionaryConfig {
  platforms: DictPlatform[]
  markets: DictMarket[]
  categories: DictCategory[]
  platform_product_field_groups?: PlatformProductFieldGroups
  unified_field_dictionary?: UnifiedFieldDictionary
  finance_entry_types?: { id: string; label: string }[]
  operation_record_types?: { id: string; label: string; ledger_entry_type?: string }[]
  operation_record_statuses?: { id: string; label: string }[]
  carriers?: { id: string; label: string }[]
  shipping_methods?: { id: string; label: string }[]
  warehouse_service_types?: { id: string; label: string }[]
  warehouse_integration_statuses?: { id: string; label: string }[]
  warehouse_inventory_sync_modes?: { id: string; label: string }[]
  inventory_alert_severities?: { id: string; label: string }[]
  inventory_alert_statuses?: { id: string; label: string }[]
  order_statuses?: { id: string; label: string; variant?: string; allowed_next?: string[]; is_exception?: boolean }[]
  shipment_statuses?: { id: string; label: string; variant?: string }[]
  product_statuses?: { id: string; label: string; variant?: string }[]
  platform_listing_statuses?: { id: string; label: string; variant?: string }[]
  ai_suggestion_severities?: { id: string; label: string; variant?: string }[]
  trend_directions?: { id: string; label: string }[]
  competition_levels?: { id: string; label: string }[]
  signal_heat_levels?: { id: string; label: string; min: number; tone?: string }[]
  sourcing_pipeline_stages?: { id: string; label: string; tone?: string }[]
  competitor_alert_conditions?: { id: string; label: string }[]
  category_legacy?: string[]
  category_options?: { value: string; label: string; keywords: string[] }[]
}

export interface PermissionConfig {
  is_admin: boolean
  permissions: string[]
  modules: string[]
}

export interface StoreScopeConfig {
  scope: 'all' | 'assigned'
  store_ids: string[]
  stores: { id: string; platform: string; account_name: string; shop_id?: string }[]
}

export interface EntitlementItem {
  feature_code: string
  feature_name: string
  enabled: boolean
  limit_value?: number | null
  unit?: string | null
}

export interface EntitlementConfig {
  subscription: {
    status: string
    plan_code?: string | null
    started_at?: string | null
    expires_at?: string | null
    source?: string | null
  }
  features: Record<string, EntitlementItem>
  data_gaps: string[]
}

export interface FullConfig extends DictionaryConfig {
  fees?: Record<string, unknown>[]
  exchange_rates?: Record<string, unknown>[]
  ai_providers?: Record<string, unknown>[]
  permissions: PermissionConfig
  store_scope: StoreScopeConfig
  entitlements: EntitlementConfig
}

export interface ConfigQualityCheck {
  code: string
  label: string
  status: 'ready' | 'configuration_required'
  count: number
  data_gaps: string[]
}

export interface ConfigQuality {
  status: 'ready' | 'configuration_required'
  checks: ConfigQualityCheck[]
  data_gaps: string[]
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
}

export async function getDictionary() {
  const res = await client.get<ApiResponse<DictionaryConfig>>('/config/init')
  return res.data
}

export async function getFullConfig() {
  const res = await client.get<ApiResponse<FullConfig>>('/config/full')
  return res.data
}

export async function getConfigQuality() {
  const res = await client.get<ApiResponse<ConfigQuality>>('/config/quality')
  return res.data
}
