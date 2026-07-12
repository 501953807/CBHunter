export type SupplierForm = {
  supplier_name: string
  purchase_price_rmb: string
  supplier_url: string
  product_image: string
  notes: string
}

export type PurchaseForm = {
  supplier_id: string
  quantity: string
  unit_cost_rmb: string
  domestic_shipping_rmb: string
  description: string
}

export type CostPayload = {
  source_price_rmb: number
  selling_price_local: number
  domestic_shipping_rmb: number
  intl_shipping_rmb: number
  packaging_cost_rmb: number
  platform_fee_pct: number
  payment_fee_pct: number
  return_reserve_pct: number
  exchange_rate: number
}

export const COST_FIELDS = [
  { key: 'domestic_shipping_rmb', label: '国内运费' },
  { key: 'intl_shipping_rmb', label: '国际运费' },
  { key: 'packaging_cost_rmb', label: '包装费' },
  { key: 'platform_fee_pct', label: '佣金率%' },
  { key: 'payment_fee_pct', label: '支付费%' },
  { key: 'return_reserve_pct', label: '退损%' },
  { key: 'exchange_rate', label: '汇率' },
  { key: 'selling_price_local', label: '售价(本币)' },
]

export function getMarketFlag(markets: any[], marketIdOrLabel?: string) {
  if (!marketIdOrLabel) return ''
  const found = markets.find(m => m.id === marketIdOrLabel || m.label === marketIdOrLabel)
  return found?.flag || ''
}

export function getLabel(items: any[], id: string) {
  return items.find((item: any) => item.id === id)?.label || id
}
