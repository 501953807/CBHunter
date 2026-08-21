import type { FeeRateItem } from '../../api/settings'
import type { PricingWorkbenchItem } from '../../api/pricing'

export function matchesPricingProduct(item: PricingWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}

export function findFeeTemplate(templates: FeeRateItem[], platform: string, market: string) {
  if (!platform || !market) return undefined
  const expectedId = `${platform}_${market}`
  return templates.find(template => template.id === expectedId)
}

export function normalizeProfitSliderValue(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(Math.max(numeric, 0.1), 60)
}

export function optionalNumber(value: string) {
  if (!value.trim()) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

export function percentLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '待配置'
  return `${(Number(value) * 100).toFixed(1)}%`
}
