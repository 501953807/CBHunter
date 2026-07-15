export interface OrderListRow {
  id: string
  order_number?: string | null
  platform: string
  source: 'platform' | 'manual' | string
  status: string
  buyer_name?: string | null
  platform_account_name?: string | null
  item_count: number
  total: number
  currency: string
  payment_status?: string | null
  fulfillment_status?: string | null
  fulfillment_deadline_at?: string | null
  logistics_channel?: string | null
  after_sales_status?: string | null
  financial_reconciliation_status: string
  platform_sync_status: OrderPlatformSyncReview
  fulfillment_exception: OrderFulfillmentException
  ordered_at?: string | null
  created_at?: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  name: string
  sku?: string | null
  quantity: number
  unit_price: number
  total_price: number
  variation_info?: Record<string, unknown> | null
}

export interface OrderDetail {
  id: string
  platform_account_id: string
  platform_order_id: string
  order_number?: string | null
  platform: string
  source: 'platform' | 'manual' | string
  status: string
  buyer_name?: string | null
  buyer_notes?: string | null
  shipping_address?: Record<string, unknown> | null
  subtotal?: number | null
  shipping_fee?: number | null
  platform_fee?: number | null
  discount?: number | null
  total: number
  currency: string
  payment_status?: string | null
  payment_method?: string | null
  fulfillment_status?: string | null
  fulfillment_deadline_at?: string | null
  logistics_channel?: string | null
  after_sales_status?: string | null
  financial_reconciliation_status: string
  platform_sync_review: OrderPlatformSyncReview
  fulfillment_exception: OrderFulfillmentException
  finance_entry_context: OrderFinanceEntryContext
  fee_breakdown: {
    components?: Array<{
      code: string
      label: string
      amount?: number | null
      currency: string
      direction: 'add' | 'deduct' | string
      source: string
      status?: string
    }>
    wallet?: Record<string, unknown>
    data_gaps?: string[]
    confidence_reason?: string
  }
  notes?: string | null
  ordered_at?: string | null
  created_at?: string | null
  items: OrderItem[]
}

export interface OrderFinanceEntryContext {
  status?: 'ledger_ready' | 'ledger_incomplete' | 'ledger_missing' | string
  entry_count?: number
  revenue_rmb?: number | null
  cost_rmb?: number | null
  net_profit_rmb?: number | null
  platform_bill_entry_count?: number
  refund_rmb?: number
  data_gaps?: string[]
  confidence_reason?: string
  actions?: Array<{
    code: string
    label: string
    route: string
    reason?: string
  }>
  recent_entries?: Array<{
    id: string
    entry_type: string
    amount_rmb: number
    currency?: string
    description?: string | null
    occurred_at?: string | null
  }>
}

export interface OrderFulfillmentException {
  status?: 'clear' | 'shipping_overdue' | 'shipping_due_soon' | 'after_sales_open' | 'logistics_missing' | 'sync_required' | string
  severity?: 'clear' | 'warning' | 'critical' | string
  reasons?: string[]
  deadline_at?: string | null
  hours_to_deadline?: number | null
  logistics_channel?: string | null
  after_sales_status?: string | null
  fulfillment_status?: string | null
  route?: string
  data_gaps?: string[]
  actions?: Array<{
    code: string
    label: string
    route: string
    priority?: 'high' | 'medium' | 'low' | string
    description?: string
  }>
}

export interface OrderPlatformSyncReview {
  status?: 'manual_not_synced' | 'sync_failed' | 'synced' | 'not_synced' | string
  source?: string
  order_last_synced_at?: string | null
  latest_store_sync?: {
    sync_log_id: string
    sync_type: string
    status: string
    started_at?: string | null
    completed_at?: string | null
    records_processed: number
    records_created: number
    records_updated: number
    records_failed: number
    error_message?: string | null
  } | null
  message?: string
  data_gaps?: string[]
}

export interface OrderFulfillmentStats {
  total_orders: number
  by_order_status: Record<string, number>
  by_fulfillment_status: Record<string, number>
  fulfillment: {
    pending_shipment: number
    shipped: number
    due_soon: number
    overdue: number
    logistics_missing: number
    after_sales_open: number
    sync_required: number
    missing_deadline: number
    data_gap_count: number
  }
  store_breakdown: Array<{
    platform_account_id: string
    platform: string
    platform_account_name: string
    total_orders: number
    pending_shipment: number
    shipped: number
    due_soon: number
    overdue: number
  }>
  data_gaps: string[]
  confidence_reason?: string | null
}

export interface ManualOrderCreate {
  platform_account_id: string
  merchant_order_number: string
  buyer_name?: string | null
  currency: string
  total: number
  ordered_at: string
  notes?: string | null
  items: { name: string; sku?: string | null; quantity: number; unit_price: number }[]
}
