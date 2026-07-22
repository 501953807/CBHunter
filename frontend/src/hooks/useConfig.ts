import { useState, useEffect } from 'react'
import {
  getDictionary,
  getFullConfig,
  type DictCategory,
  type DictMarket,
  type DictPlatform,
  type EntitlementConfig,
  type FullConfig,
  type PermissionConfig,
  type PlatformProductFieldGroups,
  type StoreScopeConfig,
  type UnifiedFieldDictionary,
} from '../api/config'
import { logger } from '../utils/logger'
export type { DictCategory, DictMarket, DictPlatform } from '../api/config'

interface ConfigState {
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
  loading: boolean
  error: string | null
}

let cachedConfig: Omit<ConfigState, 'loading' | 'error'> | null = null
let cachedFullConfig: FullConfig | null = null

export function useConfig() {
  const [state, setState] = useState<ConfigState>({
    platforms: cachedConfig?.platforms || [],
    markets: cachedConfig?.markets || [],
    categories: cachedConfig?.categories || [],
    platform_product_field_groups: cachedConfig?.platform_product_field_groups || {},
    unified_field_dictionary: cachedConfig?.unified_field_dictionary || { fields: [] },
    finance_entry_types: cachedConfig?.finance_entry_types || [],
    operation_record_types: cachedConfig?.operation_record_types || [],
    operation_record_statuses: cachedConfig?.operation_record_statuses || [],
    carriers: cachedConfig?.carriers || [],
    shipping_methods: cachedConfig?.shipping_methods || [],
    warehouse_service_types: cachedConfig?.warehouse_service_types || [],
    warehouse_integration_statuses: cachedConfig?.warehouse_integration_statuses || [],
    warehouse_inventory_sync_modes: cachedConfig?.warehouse_inventory_sync_modes || [],
    inventory_alert_severities: cachedConfig?.inventory_alert_severities || [],
    inventory_alert_statuses: cachedConfig?.inventory_alert_statuses || [],
    order_statuses: cachedConfig?.order_statuses || [],
    shipment_statuses: cachedConfig?.shipment_statuses || [],
    product_statuses: cachedConfig?.product_statuses || [],
    platform_listing_statuses: cachedConfig?.platform_listing_statuses || [],
    ai_suggestion_severities: cachedConfig?.ai_suggestion_severities || [],
    trend_directions: cachedConfig?.trend_directions || [],
    competition_levels: cachedConfig?.competition_levels || [],
    signal_heat_levels: cachedConfig?.signal_heat_levels || [],
    sourcing_pipeline_stages: cachedConfig?.sourcing_pipeline_stages || [],
    competitor_alert_conditions: cachedConfig?.competitor_alert_conditions || [],
    loading: !cachedConfig,
    error: null,
  })

  useEffect(() => {
    if (cachedConfig) return
    let cancelled = false
    getDictionary()
      .then(res => {
        if (cancelled) return
        const data = res.data
        if (data) {
          cachedConfig = data
          setState({ ...data, loading: false, error: null })
        }
      })
      .catch((e: any) => {
        if (cancelled) return
        logger.error('Config init failed', e)
        setState(prev => ({ ...prev, loading: false, error: '配置加载失败' }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}

export function useFullConfig() {
  const [state, setState] = useState<FullConfig & { loading: boolean; error: string | null }>({
    ...(cachedFullConfig || {
      platforms: [],
      markets: [],
      categories: [],
      platform_product_field_groups: {},
      unified_field_dictionary: { fields: [] },
      finance_entry_types: [],
      operation_record_types: [],
      operation_record_statuses: [],
      carriers: [],
      shipping_methods: [],
      warehouse_service_types: [],
      warehouse_integration_statuses: [],
      warehouse_inventory_sync_modes: [],
      inventory_alert_severities: [],
      inventory_alert_statuses: [],
      order_statuses: [],
      shipment_statuses: [],
      product_statuses: [],
      platform_listing_statuses: [],
      ai_suggestion_severities: [],
      trend_directions: [],
      competition_levels: [],
      signal_heat_levels: [],
      sourcing_pipeline_stages: [],
      competitor_alert_conditions: [],
      permissions: { is_admin: false, permissions: [], modules: [] } as PermissionConfig,
      store_scope: { scope: 'assigned', store_ids: [], stores: [] } as StoreScopeConfig,
      entitlements: { subscription: { status: 'loading' }, features: {}, data_gaps: [] } as EntitlementConfig,
    }),
    loading: !cachedFullConfig,
    error: null,
  })

  useEffect(() => {
    if (cachedFullConfig) return
    let cancelled = false
    getFullConfig()
      .then(res => {
        if (cancelled) return
        const data = res.data
        if (data) {
          cachedFullConfig = data
          setState({ ...data, loading: false, error: null })
        }
      })
      .catch((e: any) => {
        if (cancelled) return
        logger.error('Full config load failed', e)
        setState(prev => ({ ...prev, loading: false, error: '完整配置加载失败' }))
      })
    return () => { cancelled = true }
  }, [])

  return state
}
