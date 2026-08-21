import type { PlatformStoreProduct, PlatformStoreProductFilterSummary } from '../../api/products'
import type { PlatformAccount } from '../../types/common'

export function buildMarketOptions(stores: PlatformAccount[], platform: string, platformAccountId: string) {
  const markets = stores
    .filter(store => (!platform || store.platform === platform) && (!platformAccountId || store.id === platformAccountId))
    .map(platformStoreMarket)
    .filter((value): value is string => Boolean(value))
  return Array.from(new Set(markets)).sort().map(value => ({ value, label: value }))
}

export function platformStoreMarket(store: PlatformAccount) {
  const market = store.settings?.market
  return typeof market === 'string' ? market : ''
}

export function productSyncStatusLabel(status?: string | null) {
  if (status === 'success') return '成功'
  if (status === 'synced') return '已同步'
  if (status === 'local_draft') return '本地草稿'
  if (status === 'partial_failed') return '部分失败'
  if (status === 'failed') return '失败'
  if (status === 'running') return '同步中'
  return '未同步'
}

export function buildPlatformStoreSummary(items: PlatformStoreProduct[], apiSummary?: PlatformStoreProductFilterSummary) {
  const stores = new Set(items.map(item => item.store.id))
  const markets = new Set(items.map(item => item.store.market).filter(Boolean))
  const platforms = Array.from(new Set(items.map(item => item.platform.toUpperCase()))).sort()
  const syncedCount = items.filter(item => Boolean(item.last_synced_at)).length
  const localDraftCount = items.filter(item => item.source === 'local_listing' || !item.platform_product_id).length
  const publishQueueCount = items.filter(isPublishQueueItem).length
  const mediaGapCount = items.filter(item => {
    const captured = item.media_readiness?.captured_image_count ?? item.image_count
    const minImages = item.media_readiness?.min_platform_images ?? 5
    return captured < minImages
  }).length
  const inventoryRiskCount = items.filter(item => isInventoryRiskItem(item)).length
  const variationCount = items.reduce((sum, item) => sum + (item.variation_count || 0), 0)
  return {
    totalListingCount: numberFromSummary(apiSummary?.total_listing_count, items.length),
    storeCount: numberFromSummary(apiSummary?.store_count, stores.size),
    marketCount: numberFromSummary(apiSummary?.market_count, markets.size),
    platforms: apiSummary?.platforms?.length ? apiSummary.platforms : platforms,
    syncedCount: numberFromSummary(apiSummary?.synced_count, syncedCount),
    localDraftCount: numberFromSummary(apiSummary?.local_draft_count, localDraftCount),
    mediaGapCount: numberFromSummary(apiSummary?.media_gap_count, mediaGapCount),
    variationCount: numberFromSummary(apiSummary?.variation_count, variationCount),
    publishQueueCount: numberFromSummary(apiSummary?.publish_queue_count, publishQueueCount),
    inventoryRiskCount: numberFromSummary(apiSummary?.inventory_risk_count, inventoryRiskCount),
  }
}

function numberFromSummary(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function isInventoryRiskItem(item: PlatformStoreProduct) {
  const summary = item.inventory_alert_summary
  return Boolean(summary && ['open_alert', 'below_safety_stock', 'stockout', 'stockout_rule_missing'].includes(summary.status))
}

export function isPublishQueueItem(item: PlatformStoreProduct) {
  const summary = item.publish_plan_summary
  if (!summary) return false
  return Boolean(summary.is_local_draft || summary.queue_status === 'waiting_platform_api' || summary.queue_status === 'local_draft_pending_submit')
}

export function publishQueueLabel(status?: string) {
  if (status === 'waiting_platform_api') return '等待平台API'
  if (status === 'local_draft_pending_submit') return '本地草稿待提交'
  if (status === 'synced') return '已同步'
  if (status === 'local_draft') return '本地草稿'
  return '待复核'
}

export function inventorySummaryVariant(severity?: string): 'success' | 'warning' | 'danger' | 'info' {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  if (severity === 'success') return 'success'
  return 'info'
}

