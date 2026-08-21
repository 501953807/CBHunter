import type { ContentWorkbenchItem } from '../../api/content'

export const STATUS_LABELS: Record<string, string> = {
  not_started: '待制作',
  in_progress: '制作中',
  ready: '内容完成',
}

export type BulkActionKind = 'copy' | 'media' | 'pricing'

export function productIdForAction(item: ContentWorkbenchItem) {
  return item.object_refs?.find(ref => ref.type === 'product')?.id || item.id || item.work_item_id
}

export function workflowUrl(basePath: '/pricing' | '/publish', item: ContentWorkbenchItem) {
  const params = new URLSearchParams()
  params.set('product_id', productIdForAction(item))
  if (item.target_platform) params.set('target_platform', item.target_platform)
  if (item.target_market) params.set('target_market', item.target_market)
  const storeRef = objectRefByType(item, ['store_listing', 'platform_account', 'store'])
  if (storeRef?.id) params.set('target_store', storeRef.id)
  return `${basePath}?${params.toString()}`
}

export function bulkWorkflowUrl(basePath: '/pricing' | '/publish', items: ContentWorkbenchItem[]) {
  const params = new URLSearchParams()
  const productIds = items.map(productIdForAction).filter(Boolean)
  if (productIds.length === 1) params.set('product_id', productIds[0])
  if (productIds.length > 1) params.set('product_ids', productIds.join(','))
  const samePlatform = sameValue(items.map(item => item.target_platform).filter(isPresentString))
  const sameMarket = sameValue(items.map(item => item.target_market).filter(isPresentString))
  if (samePlatform) params.set('target_platform', samePlatform)
  if (sameMarket) params.set('target_market', sameMarket)
  const storeIds = items
    .map(item => objectRefByType(item, ['store_listing', 'platform_account', 'store'])?.id || '')
    .filter(isPresentString)
  const sameStore = sameValue(storeIds)
  if (sameStore) params.set('target_store', sameStore)
  return `${basePath}?${params.toString()}`
}

export function hasAttributeValue(values: Record<string, unknown>, field: string) {
  const value = values[field]
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value != null && value !== false
}

export function getPageSize(layout: 'table' | 'rail', tablePageSize: number) {
  return layout === 'rail' ? 6 : tablePageSize
}

export function matchesProduct(item: ContentWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}

export function storeContextLabel(item: ContentWorkbenchItem) {
  const storeRef = objectRefByType(item, ['store_listing', 'platform_account', 'store'])
  if (storeRef) return `店铺实例：${storeRef.label || storeRef.id}`
  const listingRef = objectRefByType(item, ['platform_listing', 'listing'])
  if (listingRef) return `店铺实例：待选择；关联Listing ${listingRef.label || listingRef.id}`
  return '店铺实例：待选择，批量刊登时写入当前店铺Listing'
}

export function objectRefContextLabel(item: ContentWorkbenchItem) {
  const productRef = objectRefByType(item, ['product', 'base_product'])
  return `商品对象：${productRef?.label || productRef?.id || item.id || item.work_item_id}`
}

function objectRefByType(item: ContentWorkbenchItem, types: string[]) {
  return item.object_refs?.find(ref => types.includes(ref.type))
}

function sameValue(values: string[]) {
  const unique = Array.from(new Set(values.filter(Boolean)))
  return unique.length === 1 ? unique[0] : ''
}

function isPresentString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
