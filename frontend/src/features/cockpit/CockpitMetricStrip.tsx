import { AlertTriangle, Boxes, DollarSign, ShoppingCart, Sparkles, Store, WalletCards } from 'lucide-react'
import type { CockpitData } from '../../types/cockpit'

function amount(value: number | null) {
  return value == null ? '待补数据' : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

export function CockpitMetricStrip({ data, onNavigate }: { data: CockpitData; onNavigate: (route: string) => void }) {
  const finance = data.sections.finance.metrics
  const metrics = [
    {
      label: '平台店铺',
      value: `${data.sections.store_matrix.metrics.active_store_count}/${data.sections.store_matrix.metrics.store_count}`,
      sub: `${data.sections.store_matrix.metrics.platform_count} 个平台 · ${data.sections.store_matrix.metrics.active_listings} Listing`,
      icon: Store,
      route: '/platforms',
      warning: data.sections.store_matrix.metrics.store_count === 0,
    },
    { label: '最近30天订单', value: String(data.sections.orders.metrics.order_count), sub: `${data.sections.reports.metrics.today_orders} 今日`, icon: ShoppingCart, route: '/orders' },
    {
      label: '台账收入',
      value: amount(finance.total_revenue_rmb),
      sub: `${finance.entry_count} 条财务记录`,
      icon: WalletCards,
      route: '/finance',
      warning: data.sections.finance.gaps.some((gap) => gap.includes('没有平台订单')),
    },
    { label: '净利润', value: amount(finance.net_profit_rmb), sub: `毛利率 ${finance.profit_margin_pct == null ? '待补' : `${finance.profit_margin_pct}%`}`, icon: DollarSign, route: '/finance', danger: finance.net_profit_rmb != null && finance.net_profit_rmb < 0 },
    { label: '确认库存', value: String(data.sections.inventory.metrics.confirmed_stock), sub: `${data.sections.inventory.metrics.unknown_stock_listings} 个未知库存`, icon: Boxes, route: '/inventory-alerts', warning: data.sections.inventory.metrics.unknown_stock_listings > 0 },
    { label: '商品运营', value: String(data.sections.product_operations.metrics.diagnosed_listing_count), sub: `${data.sections.product_operations.metrics.pending_action_count} 待复盘 · ${data.sections.product_operations.metrics.reviewed_action_count} 已复盘`, icon: Sparkles, route: '/growth', warning: data.sections.product_operations.metrics.pending_action_count > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6" data-ui="cockpit-v5-operating-metric-grid">
      {metrics.map((item) => (
        <button
          key={item.label}
          onClick={() => onNavigate(item.route)}
          title={`查看${item.label}明细`}
          className="cockpit-metric-card group min-w-0 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 py-3 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
          data-ui="cockpit-v5-operating-metric-card"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-muted)]">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="cockpit-metric-icon">
                <item.icon className="h-3.5 w-3.5" style={{ color: item.danger ? 'var(--color-danger)' : item.warning ? 'var(--color-warning)' : 'var(--color-primary)' }} />
              </span>
              <span className="truncate font-semibold tracking-wide">{item.label}</span>
            </span>
            {item.warning && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning)]" />}
          </div>
          <p className="mt-3 truncate text-lg font-bold tracking-tight" style={{ color: item.danger ? 'var(--color-danger)' : item.warning ? 'var(--color-warning)' : 'var(--color-fg)' }}>{item.value}</p>
          <p className="mt-1 truncate text-[11px] leading-5 text-[var(--color-muted)]">{item.sub}</p>
        </button>
      ))}
    </div>
  )
}
