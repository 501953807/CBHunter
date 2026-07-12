import { logger } from '../../utils/logger'

export const SOURCE_LABELS: Record<string, string> = {
  browser_ext: '扩展采集',
  manual: '手动录入',
  seed_v2: '历史种子来源',
  template: '来源待核验',
  default: '未知来源',
}

export function buildPlatformSearchUrl(platform: any, market: any, keyword: string) {
  const template = platform?.search_url_template
  const domain = market?.domains?.[platform?.id]
  if (!template || !domain) return null
  return template.replace('{domain}', domain).replace('{keyword}', encodeURIComponent(keyword))
}

export function formatPrice(product: any) {
  if (product.price_cny) return `¥${product.price_cny.toFixed(2)}`
  const rawPrice = product.price_min ?? product.price_max
  if (rawPrice) {
    const snapshot = typeof product.snapshot_data === 'string'
      ? safeJson(product.snapshot_data)
      : (product.snapshot_data || {})
    const currency = snapshot.currency || product.currency || '原价'
    return `${currency} ${Number(rawPrice).toFixed(2)}`
  }
  return '—'
}

function safeJson(value: string) {
  try {
    return JSON.parse(value)
  } catch (e: any) {
    logger.error('Parse trending product snapshot failed', e)
    return {}
  }
}

export function formatSales(value: number) {
  if (!value) return '—'
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

export function getSourceLabel(product: any, onParseError: (error: any) => void) {
  try {
    const snapshot = typeof product.snapshot_data === 'string' ? JSON.parse(product.snapshot_data) : (product.snapshot_data || {})
    if (snapshot.source) return SOURCE_LABELS[snapshot.source] || snapshot.source
  } catch (e: any) {
    onParseError(e)
  }
  return SOURCE_LABELS[product.source] || product.source || '未知'
}

export function matchProductTrends(product: any, trendKeywords: any[], categories: any[]) {
  if (!trendKeywords.length) return []
  const labelMap: Record<string, string> = {}
  categories.forEach((category: any) => { labelMap[category.id] = category.label })
  const text = `${product.name || ''} ${labelMap[product.category_path] || ''} ${product.category_path || ''}`.toLowerCase()
  const matched: any[] = []
  for (const keyword of trendKeywords) {
    const cnTerms: string[] = keyword.cn_terms || []
    if (text.includes(keyword.keyword.toLowerCase())) {
      matched.push({ ...keyword, match_type: 'keyword' })
      continue
    }
    for (const cn of cnTerms) {
      if (cn && text.includes(cn.toLowerCase())) {
        matched.push({ ...keyword, match_type: 'translation' })
        break
      }
    }
  }
  return matched
}
