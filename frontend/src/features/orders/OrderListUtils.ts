import type { ManualOrderCreate } from '../../types/order'

export function buildOrderSearchParams(
  exceptionMode: boolean,
  platformAccountId: string,
  platform: string,
  fulfillmentExceptionStatus = '',
  syncStatus = '',
  shippingSla = '',
) {
  const params: Record<string, string> = {}
  if (exceptionMode) params.exceptions = '1'
  if (platformAccountId) params.platform_account_id = platformAccountId
  if (platform) params.platform = platform
  if (fulfillmentExceptionStatus) params.fulfillment_exception_status = fulfillmentExceptionStatus
  if (syncStatus) params.sync_status = syncStatus
  if (shippingSla) params.shipping_sla = shippingSla
  return params
}

export function parseManualOrderCsv(csvText: string): ManualOrderCreate[] {
  const rows = splitCsvRows(csvText.trim())
  if (rows.length < 2) {
    throw new Error('CSV 至少需要表头和一行订单数据')
  }
  const headers = rows[0].map((header) => header.trim())
  const required = ['platform_account_id', 'merchant_order_number', 'ordered_at', 'currency', 'total', 'item_name', 'item_quantity', 'item_unit_price']
  const missing = required.filter((field) => !headers.includes(field))
  if (missing.length) {
    throw new Error(`CSV 缺少必填字段：${missing.join(', ')}`)
  }
  const orders = new Map<string, ManualOrderCreate>()
  rows.slice(1).forEach((values) => {
    if (!values.some((value) => value.trim())) return
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ''])) as Record<string, string>
    const key = `${row.platform_account_id}::${row.merchant_order_number}`
    const item = {
      name: row.item_name,
      sku: row.item_sku || null,
      quantity: toPositiveInt(row.item_quantity),
      unit_price: toNonNegativeNumber(row.item_unit_price),
    }
    const existing = orders.get(key)
    if (existing) {
      existing.items.push(item)
      return
    }
    orders.set(key, {
      platform_account_id: row.platform_account_id,
      merchant_order_number: row.merchant_order_number,
      status: row.status || 'pending',
      buyer_name: row.buyer_name || null,
      shipping_address: row.shipping_address ? { raw: row.shipping_address, source: 'csv_import' } : null,
      shipping_fee: toOptionalNumber(row.shipping_fee),
      platform_fee: toOptionalNumber(row.platform_fee),
      discount: toOptionalNumber(row.discount),
      currency: (row.currency || 'CNY').toUpperCase(),
      total: toNonNegativeNumber(row.total),
      payment_status: row.payment_status || null,
      payment_method: row.payment_method || null,
      fulfillment_status: row.fulfillment_status || null,
      fulfillment_deadline_at: row.fulfillment_deadline_at || null,
      logistics_channel: row.logistics_channel || null,
      ordered_at: row.ordered_at,
      notes: row.notes || null,
      items: [item],
    })
  })
  return Array.from(orders.values())
}

export function orderListText(value?: string | null) {
  if (!value) return '待补'
  if (value === 'none') return '无'
  return value
}

export function orderSourceLabel(value?: string | null) {
  if (value === 'manual_import') return '批量导入'
  if (value === 'manual') return '手工录入'
  return '平台数据'
}

export function reconciliationLabel(value?: string | null) {
  if (value === 'bill_imported') return '已导入账单'
  if (value === 'reconciled') return '已对账'
  return '待对账'
}

export function syncStatusLabel(value?: string | null) {
  if (value === 'synced') return '已同步'
  if (value === 'sync_failed') return '同步异常'
  if (value === 'manual_not_synced') return '手工未同步'
  if (value === 'not_synced') return '未同步'
  return '待确认'
}

export function syncBadgeVariant(value?: string | null) {
  if (value === 'synced') return 'success'
  if (value === 'sync_failed') return 'danger'
  if (value === 'manual_not_synced' || value === 'not_synced') return 'warning'
  return 'outline'
}

export function fulfillmentStatusLabel(value?: string | null) {
  if (value === 'shipping_overdue') return '发货超期'
  if (value === 'shipping_due_soon') return '临近时限'
  if (value === 'after_sales_open') return '售后处理中'
  if (value === 'logistics_missing') return '物流待补'
  if (value === 'sync_required') return '同步待补'
  if (value === 'clear') return '正常'
  return '待确认'
}

export function fulfillmentBadgeVariant(value?: string | null) {
  if (value === 'critical') return 'danger'
  if (value === 'warning') return 'warning'
  if (value === 'clear') return 'success'
  return 'outline'
}

export function shippingSlaLabel(hours?: number | null) {
  if (hours == null || Number.isNaN(Number(hours))) return '发货时限待补'
  if (hours < 0) return `已超期 ${Math.abs(hours).toFixed(1)} 小时`
  if (hours <= 12) return `距发货截止 ${hours.toFixed(1)} 小时`
  if (hours <= 24) return `24小时内到期：${hours.toFixed(1)} 小时`
  return `距发货截止 ${hours.toFixed(1)} 小时`
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }
    current += char
  }
  row.push(current)
  rows.push(row)
  return rows.filter((item) => item.some((value) => value.trim()))
}

function toOptionalNumber(value?: string) {
  if (!value) return null
  return toNonNegativeNumber(value)
}

function toNonNegativeNumber(value?: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`数值字段不合法：${value || ''}`)
  }
  return number
}

function toPositiveInt(value?: string) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`数量字段不合法：${value || ''}`)
  }
  return number
}
