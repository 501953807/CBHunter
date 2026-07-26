import client from './client'
import type { ApiResponse } from '../types/common'

export type FinancePeriod = 'daily' | 'weekly' | 'monthly'

export type FinanceSummary = {
  period: FinancePeriod
  total_revenue_rmb: number | null
  total_cost_rmb: number | null
  net_profit_rmb: number | null
  profit_margin_pct: number | null
  cash_balance_rmb: number | null
  entry_count: number
  cost_breakdown: Record<string, number>
  platform_settlement: PlatformSettlementSummary
  risk_signals?: FinanceRiskSignal[]
  data_status: 'ready' | 'data_required'
  source_refs?: Array<Record<string, unknown>>
  evidence_window?: string
  confidence_reason?: string
  data_gaps?: string[]
}

export type FinanceRiskSignal = {
  code: string
  level: 'info' | 'medium' | 'high' | string
  title: string
  detail: string
  action_label: string
  action_route: string
}

export type PlatformSettlementSummary = {
  wallet_balances: PlatformWalletBalance[]
  movement_totals: Record<string, number>
  order_reconciliation: {
    linked_order_count: number
    linked_entry_count: number
  }
}

export type PlatformWalletBalance = {
  platform: string | null
  market: string | null
  amount_rmb: number
  amount_original: number | null
  currency: string
  account_name: string | null
  reference_rate: string | null
  source_entry_id: string
  occurred_at: string | null
}

export type FinanceTraceback = {
  period: FinancePeriod
  summary: {
    order_count: number
    product_count: number
    store_count: number
    entry_count: number
    total_revenue_rmb: number | null
    total_cost_rmb: number | null
    net_profit_rmb: number | null
    refund_rmb: number
    platform_bill_rmb: number
    settlement_movement_rmb: number
  }
  by_order: FinanceTracebackOrder[]
  by_product: FinanceTracebackProduct[]
  by_store: FinanceTracebackStore[]
  data_status: 'ready' | 'data_required'
}

export type FinanceTracebackBase = {
  platform: string | null
  market: string | null
  revenue_rmb: number | null
  cost_rmb: number | null
  net_profit_rmb: number | null
  cost_breakdown: Record<string, number>
  entry_count: number
  source_entry_ids: string[]
  data_gaps: string[]
}

export type FinanceTracebackOrder = FinanceTracebackBase & {
  order_id: string
  account_name: string | null
}

export type FinanceTracebackProduct = FinanceTracebackBase & {
  product_id: string
  product_name: string
  v5_sku_contexts?: Array<{
    status?: 'matched' | 'unmatched' | string
    source?: 'v5_product_sku_variants' | string
    platform_listing_id?: string | null
    sku_variant_id?: string
    ledger_sku?: string | null
    merchant_sku?: string
    platform_sku?: string | null
    spu?: string | null
    skc?: string | null
    option_1?: { name?: string | null; value?: string | null } | null
    option_2?: { name?: string | null; value?: string | null } | null
    listing_stock?: number | null
    listing_price?: number | null
    source_entry_id?: string
    available_sku_count?: number
    data_gaps?: string[]
  }>
}

export type FinanceTracebackStore = FinanceTracebackBase & {
  store_key: string
  account_name: string | null
}

export type FinanceLedgerCreate = {
  entry_type: string
  amount_rmb: number
  amount_original?: number | null
  currency?: string
  platform?: string | null
  market?: string | null
  order_id?: string | null
  sourcing_item_id?: string | null
  description?: string | null
  extra?: Record<string, unknown>
  occurred_at?: string | null
}

export type FinanceLedgerEntry = FinanceLedgerCreate & {
  id: string
  currency: string
  extra: Record<string, unknown>
  occurred_at: string
}

export type PlatformBillImportRecord = {
  import_ref?: string | null
  entry_type: string
  amount_rmb: number
  amount_original?: number | null
  currency?: string
  platform?: string | null
  market?: string | null
  order_id?: string | null
  sourcing_item_id?: string | null
  account_name?: string | null
  product_name?: string | null
  description?: string | null
  occurred_at?: string | null
}

export type PlatformBillImportResult = {
  imported_count: number
  skipped_count: number
  imported_entry_ids: string[]
  skipped: Array<{ import_ref: string | null; reason: string }>
}

export type PlatformBillSyncResult = {
  sync_log_id: string
  status: string
  platform_account_id: string
  platform: string
  account_name: string
  connection_status?: string | null
  implementation_status?: string | null
  import_result: PlatformBillImportResult
  data_gaps: string[]
  message?: string | null
  next_action?: string | null
}

export type FinanceEntryTypeOption = {
  id: string
  label: string
  source: 'dictionary' | 'history'
}

export async function getFinanceSummary(period: FinancePeriod, params?: { platform_account_id?: string }) {
  const res = await client.get<ApiResponse<FinanceSummary>>('/finance/summary', { params: { period, ...params } })
  return res.data
}

export async function getFinanceTraceback(period: FinancePeriod, params?: { platform_account_id?: string }) {
  const res = await client.get<ApiResponse<FinanceTraceback>>('/finance/traceback', { params: { period, ...params } })
  return res.data
}

export async function listFinanceLedger(params?: { page?: number; page_size?: number; entry_type?: string; platform_account_id?: string; order_id?: string }) {
  const res = await client.get<ApiResponse<FinanceLedgerEntry[]>>('/finance/ledger', { params })
  return res.data
}

export async function listFinanceEntryTypes() {
  const res = await client.get<ApiResponse<FinanceEntryTypeOption[]>>('/finance/entry-types')
  return res.data
}

export async function createFinanceLedger(data: FinanceLedgerCreate) {
  const res = await client.post<ApiResponse<any>>('/finance/ledger', data)
  return res.data
}

export async function importPlatformBills(data: { records: PlatformBillImportRecord[] }) {
  const res = await client.post<ApiResponse<PlatformBillImportResult>>('/finance/platform-bills/import', data)
  return res.data
}

export async function syncPlatformBills(data: { platform_account_id: string; start_at?: string | null; end_at?: string | null }) {
  const res = await client.post<ApiResponse<PlatformBillSyncResult>>('/finance/platform-bills/sync', data)
  return res.data
}
