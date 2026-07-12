import { AlertTriangle, Boxes, Brain, Database, DollarSign, GitBranch, ShoppingCart, Sparkles, WalletCards } from 'lucide-react'
import type { CockpitData } from '../../types/cockpit'

function amount(value: number | null) {
  return value == null ? '待补数据' : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

export function CockpitMetricStrip({ data, onNavigate }: { data: CockpitData; onNavigate: (route: string) => void }) {
  const finance = data.sections.finance.metrics
  const gaps = Object.values(data.sections).reduce((sum, section) => sum + section.gaps.length, 0)
  const metrics = [
    { label: '近30天订单', value: String(data.sections.orders.metrics.order_count), sub: `${data.sections.reports.metrics.today_orders} 今日`, icon: ShoppingCart, route: '/orders' },
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
    { label: '开放风险', value: String(data.sections.risk_summary.metrics.active_risk_count), sub: `高危 ${data.sections.risk_summary.metrics.critical} · 警告 ${data.sections.risk_summary.metrics.warning}`, icon: AlertTriangle, route: '/risk-control', danger: data.sections.risk_summary.metrics.critical > 0, warning: data.sections.risk_summary.metrics.warning > 0 },
    { label: '链路阻塞', value: String(data.sections.flow_summary.metrics.blocked), sub: `${data.sections.flow_summary.metrics.ready}/${data.sections.flow_summary.metrics.stage_count} 阶段就绪`, icon: GitBranch, route: '/business-flow', danger: data.sections.flow_summary.metrics.blocked > 0, warning: data.sections.flow_summary.metrics.data_required > 0 },
    { label: 'AI未读', value: String(data.sections.ai_suggestions.metrics.unread), sub: `${data.sections.ai_suggestions.metrics.critical_unread} 条紧急`, icon: Brain, route: '/ai-suggestions', danger: data.sections.ai_suggestions.metrics.critical_unread > 0 },
    { label: '数据健康', value: data.data_status === 'ready' ? '已接入' : '待补', sub: `${gaps} 个缺口 · ${data.attention_count} 项待处理`, icon: Database, route: '/reports', warning: data.data_status !== 'ready' || gaps > 0 },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:grid-cols-9">
      {metrics.map((item) => (
        <button
          key={item.label}
          onClick={() => onNavigate(item.route)}
          title={`查看${item.label}明细`}
          className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            <item.icon className="h-3.5 w-3.5" style={{ color: item.danger ? 'var(--color-danger)' : item.warning ? 'var(--color-warning)' : 'var(--color-primary)' }} />
            <span>{item.label}</span>
            {item.warning && <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />}
          </div>
          <p className="mt-1 truncate text-base font-semibold" style={{ color: item.danger ? 'var(--color-danger)' : item.warning ? 'var(--color-warning)' : 'var(--color-fg)' }}>{item.value}</p>
          <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">{item.sub}</p>
        </button>
      ))}
    </div>
  )
}
