import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Store, TrendingUp, WalletCards } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { MetricStackBar } from '../../components/shared/MetricStackBar'
import type { CockpitData } from '../../types/cockpit'
import { money } from './CockpitCommandWidgets'

const chartColors = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
]

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  background: 'var(--color-surface)',
  color: 'var(--color-fg)',
}

export function HeroMetric({ label, value, detail, tone = 'primary' }: { label: string; value: string; detail: string; tone?: 'primary' | 'danger' }) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold" style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-fg)' }}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </article>
  )
}

export function HeroAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--color-fg)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{detail}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-[var(--color-primary)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  )
}

export function NegativeProfitAlert({
  totalProfit,
  stores,
  onNavigate,
}: {
  totalProfit: number | null
  stores: CockpitData['sections']['store_matrix']['items']
  onNavigate: (route: string) => void
}) {
  return (
    <section
      data-ui="cockpit-negative-profit-alert"
      className="mb-4 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] p-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--color-danger)]">负毛利警示</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
            当前经营范围净利为 {money(totalProfit)}；{stores.length > 0 ? `${stores.length} 个店铺出现负利润。` : '公司级净利润为负。'}
            需要复核采购成本、平台费率、广告费用、物流费用和汇率配置，避免只看订单量误判经营质量。
          </p>
          {stores.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stores.slice(0, 4).map((store) => (
                <span key={store.id} className="rounded bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-danger)]">
                  {store.account_name} {money(store.net_profit_rmb)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/finance?view=traceback')}
            className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-xs font-medium text-[var(--color-primary-text)] transition hover:opacity-90"
          >
            复核成本利润
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/settings/fees')}
            className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-surface)] px-3 py-2 text-xs font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-bg)]"
          >
            配置费率与汇率
          </button>
        </div>
      </div>
    </section>
  )
}

export function StoreSummaryTiles({
  comparison,
  metrics,
}: {
  comparison: CockpitData['comparison']
  metrics: CockpitData['sections']['store_matrix']['metrics']
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <SummaryTile icon={<Store className="h-4 w-4" />} label="全部店铺" value={`${metrics.active_store_count}/${metrics.store_count}`} sub="活跃/总店铺" />
      <SummaryTile icon={<TrendingUp className="h-4 w-4" />} label="范围内订单" value={String(comparison.current.orders)} sub={<RateText mom={comparison.rates.orders_mom_pct} yoy={comparison.rates.orders_yoy_pct} />} />
      <SummaryTile icon={<WalletCards className="h-4 w-4" />} label="范围内收入" value={money(comparison.current.revenue_rmb)} sub={<RateText mom={comparison.rates.revenue_mom_pct} yoy={comparison.rates.revenue_yoy_pct} />} />
      <SummaryTile icon={<WalletCards className="h-4 w-4" />} label="范围内净利润" value={money(comparison.current.net_profit_rmb)} sub={<RateText mom={comparison.rates.profit_mom_pct} yoy={comparison.rates.profit_yoy_pct} />} danger={comparison.current.net_profit_rmb != null && comparison.current.net_profit_rmb < 0} />
    </div>
  )
}

function SummaryTile({ icon, label, value, sub, danger }: { icon: ReactNode; label: string; value: string; sub: ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="text-[var(--color-primary)]">{icon}</span>
        {label}
      </div>
      <p className="mt-2 truncate text-xl font-bold" style={{ color: danger ? 'var(--color-danger)' : 'var(--color-fg)' }}>{value}</p>
      <div className="mt-1 text-[11px] text-[var(--color-muted)]">{sub}</div>
    </div>
  )
}

function RateText({ mom, yoy }: { mom: number | null; yoy: number | null }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <RateBadge label="环比" value={mom} />
      <RateBadge label="同比" value={yoy} />
    </span>
  )
}

function RateBadge({ label, value }: { label: string; value: number | null }) {
  if (value == null) return <span>{label}待补</span>
  const positive = value >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={positive ? 'inline-flex items-center gap-0.5 text-[var(--color-success)]' : 'inline-flex items-center gap-0.5 text-[var(--color-danger)]'}>
      <Icon className="h-3 w-3" />
      {label}{Math.abs(value)}%
    </span>
  )
}

export function StoreFinanceDistributionPanel({
  ledgerEntryCount,
  storeFinanceRows,
}: {
  ledgerEntryCount: number
  storeFinanceRows: any[]
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">店铺资金分布</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">分店铺展示收入、投入/成本和净利；只统计明确绑定店铺的财务台账。</p>
        </div>
        <Badge variant="outline">绑定台账 {ledgerEntryCount}</Badge>
      </div>
      {storeFinanceRows.length === 0 ? (
        <EmptyChart text="暂无绑定到店铺的收入、投入或净利台账" />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, storeFinanceRows.length * 38)}>
          <BarChart data={storeFinanceRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={118} stroke="var(--color-muted)" />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => money(Number(value))} />
            <Bar dataKey="revenue" name="收入" fill="var(--color-success)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="cost" name="投入/成本" fill="var(--color-warning)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="profit" name="净利" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function OperatingComparisonPanels({
  comparisonRows,
  currentWindow,
  onNavigate,
  platformRows,
  shareRows,
}: {
  comparisonRows: any[]
  currentWindow: string
  onNavigate: (route: string) => void
  platformRows: any[]
  shareRows: any[]
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">经营范围对比</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">图例直接显示统计天数；悬停查看每组起止日期。</p>
          </div>
          <span className="text-[11px] text-[var(--color-muted)]">{currentWindow}</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparisonRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === '订单' ? value : money(Number(value)), name]} labelFormatter={(_, rows) => rows?.[0]?.payload?.window || ''} />
            <Bar dataKey="orders" name="订单" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revenue" name="收入" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="利润" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-fg)]">平台经营分布</p>
          <button className="text-xs text-[var(--color-primary)] hover:underline" onClick={() => onNavigate('/platforms')}>管理平台店铺</button>
        </div>
        {platformRows.length === 0 ? (
          <EmptyChart text="暂无平台店铺数据" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={platformRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="platform" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="orders" name="订单" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="listings" name="Listing" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 xl:col-span-2">
        <p className="mb-2 text-sm font-semibold text-[var(--color-fg)]">平台占比</p>
        {shareRows.every((row) => row.value === 0) ? (
          <EmptyChart text="暂无订单或 Listing 占比" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={shareRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                {shareRows.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export function StoreContributionRanking({
  displayStores,
  onNavigate,
  storeRows,
}: {
  displayStores: CockpitData['sections']['store_matrix']['items']
  onNavigate: (route: string) => void
  storeRows: any[]
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-fg)]">店铺贡献排行</p>
        <span className="text-[11px] text-[var(--color-muted)]">按订单优先、无订单时按 Listing 贡献排序</span>
      </div>
      {storeRows.length === 0 ? (
        <EmptyChart text="暂无店铺经营排行" />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
          <ResponsiveContainer width="100%" height={Math.max(220, storeRows.length * 34)}>
            <BarChart data={storeRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} stroke="var(--color-muted)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="contribution" name="贡献值" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">店铺</th>
                  <th className="px-3 py-2 font-medium">平台</th>
                  <th className="px-3 py-2 font-medium">订单</th>
                  <th className="px-3 py-2 font-medium">Listing</th>
                  <th className="px-3 py-2 font-medium">收入</th>
                  <th className="px-3 py-2 font-medium">投入/成本</th>
                  <th className="px-3 py-2 font-medium">净利</th>
                  <th className="px-3 py-2 font-medium">同步</th>
                  <th className="px-3 py-2 text-right font-medium">下钻</th>
                </tr>
              </thead>
              <tbody>
                {displayStores.map((store) => (
                  <tr key={store.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--color-fg)]">{store.account_name}</p>
                      <div className="mt-1">
                        <MetricStackBar
                          ariaLabel="店铺经营贡献结构"
                          segments={[
                            { label: '订单', value: store.order_count, color: 'var(--color-primary)' },
                            { label: 'Listing', value: store.active_listings, color: 'var(--color-info)' },
                          ]}
                          emptyLabel="订单和 Listing 待同步"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{store.platform} · {formatMarketLabel(store.market)}</td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">{store.order_count}</td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">
                      <p>{store.active_listings}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{revenueText(store.revenue_by_currency) || '收入待同步'}</p>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">
                      <p>{money(store.revenue_rmb)}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">台账 {store.ledger_entry_count}</p>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">{money(store.cost_rmb)}</td>
                    <td className="px-3 py-2" style={{ color: store.net_profit_rmb != null && store.net_profit_rmb < 0 ? 'var(--color-danger)' : 'var(--color-fg)' }}>{money(store.net_profit_rmb)}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{store.last_sync_at ? new Date(store.last_sync_at).toLocaleString('zh-CN') : '未同步'}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>店铺商品</button>
                        <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/orders?platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>订单</button>
                        <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/shipments?platform_account_id=${encodeURIComponent(store.id)}&platform=${encodeURIComponent(store.platform)}`)}>物流</button>
                        <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/finance?platform_account_id=${encodeURIComponent(store.id)}`)}>财务</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">{text}</div>
}

function revenueText(values: { currency: string; orders: number; revenue: number }[]) {
  if (values.length === 0) return ''
  return values.slice(0, 2).map((item) => `${item.currency} ${item.revenue.toLocaleString()} / ${item.orders}单`).join('；')
}

function formatMarketLabel(value?: string | null) {
  if (!value || value.toLowerCase() === 'unknown') return '--'
  return value
}
