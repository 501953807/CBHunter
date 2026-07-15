import type { CockpitData, CockpitFilters, CockpitSection, CockpitSourceRef } from '../../types/cockpit'

type AnySection = CockpitSection<Record<string, unknown>, Record<string, unknown>>

const emptyWindow = '当前接口未返回该区块数据范围'

export function normalizeCockpitData(input: CockpitData | null): CockpitData | null {
  if (!input) return null
  const raw = input as any
  const sections = raw.sections || {}
  return {
    ...raw,
    generated_at: raw.generated_at || new Date().toISOString(),
    data_status: raw.data_status || 'data_required',
    attention_count: Number(raw.attention_count || 0),
    comparison: normalizeComparison(raw.comparison),
    active_filters: normalizeFilters(raw.active_filters),
    sections: {
      orders: normalizeSection(sections.orders, { order_count: 0, revenue_by_currency: [] }),
      finance: normalizeSection(sections.finance, {
        total_revenue_rmb: null,
        total_cost_rmb: null,
        net_profit_rmb: null,
        profit_margin_pct: null,
        entry_count: 0,
      }),
      inventory: normalizeSection(sections.inventory, {
        active_listings: 0,
        confirmed_listings: 0,
        confirmed_stock: 0,
        unknown_stock_listings: 0,
        open_alerts: 0,
      }),
      product_operations: normalizeSection(sections.product_operations, {
        listing_count: 0,
        diagnosed_listing_count: 0,
        action_record_count: 0,
        pending_action_count: 0,
        reviewed_action_count: 0,
      }, ['商品运营表现数据待后端升级返回']),
      competitors: normalizeSection(sections.competitors, { tracked: 0, price_changes_detected: 0 }),
      alerts: normalizeSection(sections.alerts, { open: 0, critical: 0, warning: 0 }),
      reports: normalizeSection(sections.reports, { today_orders: 0, anomaly_count: 0, cost_status: 'missing' }),
      ai_suggestions: normalizeSection(sections.ai_suggestions, { active: 0, unread: 0, critical_unread: 0 }),
      store_matrix: normalizeSection(sections.store_matrix, {
        store_count: 0,
        active_store_count: 0,
        platform_count: 0,
        order_count: 0,
        active_listings: 0,
        ledger_entry_count: 0,
        total_revenue_rmb: null,
        total_cost_rmb: null,
        net_profit_rmb: null,
      }, ['平台店铺矩阵数据待后端升级返回']),
      risk_summary: normalizeSection(sections.risk_summary, {
        active_risk_count: 0,
        critical: 0,
        warning: 0,
      }, ['风险摘要数据待后端升级返回']),
      flow_summary: normalizeSection(sections.flow_summary, {
        stage_count: 0,
        blocked: 0,
        ready: 0,
        data_required: 0,
      }, ['链路摘要数据待后端升级返回']),
    },
  }
}

function normalizeComparison(raw: any): CockpitData['comparison'] {
  const empty = { orders: 0, revenue_rmb: null, cost_rmb: null, net_profit_rmb: null, ledger_entries: 0 }
  return {
    current: { ...empty, ...(raw?.current || {}) },
    previous: { ...empty, ...(raw?.previous || {}) },
    last_year: { ...empty, ...(raw?.last_year || {}) },
    rates: {
      orders_mom_pct: raw?.rates?.orders_mom_pct ?? null,
      orders_yoy_pct: raw?.rates?.orders_yoy_pct ?? null,
      revenue_mom_pct: raw?.rates?.revenue_mom_pct ?? null,
      revenue_yoy_pct: raw?.rates?.revenue_yoy_pct ?? null,
      profit_mom_pct: raw?.rates?.profit_mom_pct ?? null,
      profit_yoy_pct: raw?.rates?.profit_yoy_pct ?? null,
    },
    windows: {
      current: raw?.windows?.current || '',
      previous: raw?.windows?.previous || '',
      last_year: raw?.windows?.last_year || '',
    },
  }
}

function normalizeSection<TMetrics extends Record<string, unknown>, TItem extends Record<string, unknown>>(
  section: CockpitSection<TMetrics, TItem> | undefined,
  metrics: TMetrics,
  fallbackGaps: string[] = [],
): CockpitSection<TMetrics, TItem> {
  const raw = (section || {}) as Partial<AnySection> & { data_gaps?: string[] }
  const gaps = arrayOfStrings(raw.gaps).length > 0 ? arrayOfStrings(raw.gaps) : arrayOfStrings(raw.data_gaps)
  return {
    status: raw.status === 'ready' ? 'ready' : 'data_required',
    source_count: Number(raw.source_count || 0),
    source_refs: Array.isArray(raw.source_refs) ? raw.source_refs as CockpitSourceRef[] : [],
    evidence_window: typeof raw.evidence_window === 'string' ? raw.evidence_window : emptyWindow,
    metrics: { ...metrics, ...(raw.metrics || {}) } as TMetrics,
    items: Array.isArray(raw.items) ? raw.items as TItem[] : [],
    gaps: gaps.length > 0 ? gaps : fallbackGaps,
    actions: Array.isArray(raw.actions) ? raw.actions : [],
  }
}

function normalizeFilters(filters: Partial<CockpitData['active_filters']> | undefined): CockpitData['active_filters'] {
  const current = filters || {}
  return {
    start_date: current.start_date || '',
    end_date: current.end_date || '',
    platform: current.platform ?? null,
    market: current.market ?? null,
    platform_account_id: current.platform_account_id ?? null,
    currency: current.currency ?? null,
    store_count: Number(current.store_count || 0),
  } as Required<Pick<CockpitFilters, 'start_date' | 'end_date'>> & {
    platform?: string | null
    market?: string | null
    platform_account_id?: string | null
    currency?: string | null
    store_count: number
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
