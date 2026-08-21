import type { FinancePeriod } from '../../api/finance'

export const PERIOD_TABS: { id: FinancePeriod; label: string }[] = [
  { id: 'daily', label: '日报' },
  { id: 'weekly', label: '周报' },
  { id: 'monthly', label: '月报' },
]

export const PLATFORM_BILL_JSON_EXAMPLE = JSON.stringify([
  {
    import_ref: 'MS-BILL-ORDER-001',
    entry_type: 'sales_income',
    amount_rmb: 218.5,
    order_id: 'ORDER-SG-20260716-001',
    platform: 'tiktok_shop',
    market: 'SG',
    account_name: 'SG 主店',
    product_name: '旅行收纳洗漱包',
    description: 'TikTok Shop 订单收入',
  },
  {
    import_ref: 'MS-BILL-FEE-001',
    entry_type: 'platform_fee',
    amount_rmb: 18.2,
    order_id: 'ORDER-SG-20260716-001',
    platform: 'tiktok_shop',
    market: 'SG',
    account_name: 'SG 主店',
    description: '平台佣金和交易费',
  },
  {
    import_ref: 'MS-BILL-CASH-001',
    entry_type: 'cash_balance',
    amount_rmb: 12680,
    platform: 'tiktok_shop',
    market: 'SG',
    account_name: 'SG 主店',
    description: '卖家钱包可用资金余额',
  },
], null, 2)

export function formatMoney(value: number | null | undefined) {
  return value == null ? '--' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function financeEntryLabel(options: { id: string; label: string }[], key: string) {
  return options.find(item => item.id === key)?.label || key
}

export function labelFor(options: { id: string; label: string }[], key: string | null) {
  return key ? options.find(item => item.id === key)?.label || key : ''
}

