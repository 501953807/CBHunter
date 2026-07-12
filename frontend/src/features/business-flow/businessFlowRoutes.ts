import type { BusinessFlowBusItem, BusinessFlowNextAction } from '../../types/businessFlow'

type ObjectRouteSource = Pick<BusinessFlowBusItem, 'id' | 'stage_key' | 'work_item_id' | 'object_refs' | 'platform' | 'market'>
  | Pick<BusinessFlowNextAction, 'stage_key' | 'work_item_id' | 'object_refs'>

export function buildObjectRoute(route: string, source: ObjectRouteSource, fallback?: BusinessFlowBusItem | null) {
  const nextRoute = route || '/'
  const stageKey = source.stage_key || fallback?.stage_key || ''
  const productId = productRefId(source.object_refs || fallback?.object_refs) || ('id' in source ? source.id : fallback?.id) || ''
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
  if (nextRoute.startsWith('/pricing') || stageKey === 'pricing') {
    return withParams(nextRoute, { content_item_id: contentItemId })
  }
  if (nextRoute.startsWith('/products/')) {
    return nextRoute
  }
  if (nextRoute.startsWith('/publish') || stageKey === 'listing') {
    return withParams(nextRoute, { product_id: productId || contentItemId })
  }
  return nextRoute
}

function productRefId(refs?: Array<{ type: string; id: string }>) {
  return refs?.find((ref) => ref.type === 'product')?.id || ''
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
