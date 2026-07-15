import type { BusinessFlowBusItem, BusinessFlowNextAction } from '../../types/businessFlow'

type ObjectRouteSource = Pick<BusinessFlowBusItem, 'id' | 'stage_key' | 'work_item_id' | 'object_refs' | 'platform' | 'market'>
  | Pick<BusinessFlowNextAction, 'stage_key' | 'work_item_id' | 'object_refs'>

export function buildObjectRoute(route: string, source: ObjectRouteSource, fallback?: BusinessFlowBusItem | null) {
  const nextRoute = route || '/'
  const stageKey = source.stage_key || fallback?.stage_key || ''
  const productId = productRefId(source.object_refs || fallback?.object_refs) || ('id' in source ? source.id : fallback?.id) || ''
  const sourcingItemId = refId(source.object_refs || fallback?.object_refs, 'sourcing_item') || (stageKey === 'sourcing' && 'id' in source ? source.id : fallback?.id) || ''
  const orderId = refId(source.object_refs || fallback?.object_refs, 'order') || (stageKey === 'fulfillment' && 'id' in source ? source.id : fallback?.id) || ''
  const listingId = refId(source.object_refs || fallback?.object_refs, 'platform_listing') || ''
  const contentItemId = ('id' in source ? source.id : fallback?.id) || productId
  const candidateId = source.work_item_id || fallback?.work_item_id || productId || contentItemId
  const platform = ('platform' in source ? source.platform : fallback?.platform) || fallback?.platform || ''
  const market = ('market' in source ? source.market : fallback?.market) || fallback?.market || ''

  if (nextRoute.startsWith('/product-selection') || stageKey === 'selection') {
    return withParams(nextRoute, { candidate_id: candidateId, platform, market })
  }
  if (nextRoute.startsWith('/content') || stageKey === 'content') {
    return withParams(nextRoute, { product_id: productId || contentItemId })
  }
  if (nextRoute.startsWith('/scout/sources') || stageKey === 'sourcing') {
    return withParams(nextRoute, { sourcing_item_id: sourcingItemId || candidateId, platform, market })
  }
  if (nextRoute.startsWith('/pricing') || stageKey === 'pricing') {
    return withParams(nextRoute, {
      content_item_id: contentItemId && contentItemId !== productId ? contentItemId : '',
      product_id: productId || contentItemId,
    })
  }
  if (nextRoute.startsWith('/products/')) {
    return nextRoute
  }
  if (nextRoute.startsWith('/publish') || stageKey === 'listing') {
    return withParams(nextRoute, { product_id: productId || contentItemId, listing_id: listingId })
  }
  if (nextRoute.startsWith('/orders') || stageKey === 'fulfillment') {
    return withParams(nextRoute, { order_id: orderId || candidateId })
  }
  if (nextRoute.startsWith('/growth') || stageKey === 'optimization') {
    return withParams(nextRoute, { product_id: productId, listing_id: listingId })
  }
  return nextRoute
}

function productRefId(refs?: Array<{ type: string; id: string }>) {
  return refId(refs, 'product')
}

function refId(refs: Array<{ type: string; id: string }> | undefined, type: string) {
  return refs?.find((ref) => ref.type === type)?.id || ''
}

function withParams(route: string, params: Record<string, string>) {
  const [path, rawQuery = ''] = route.split('?')
  const search = new URLSearchParams(rawQuery)
  Object.entries(params).forEach(([key, value]) => {
    if (value && !search.has(key)) search.set(key, value)
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
