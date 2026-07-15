import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Store, TrendingUp, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '../../components/ui/Badge'
import { CommandInsightStrip } from '../../components/shared/CommandInsightStrip'
import { ComparisonRangeCards } from '../../components/shared/ComparisonRangeCards'
import { MetricStackBar } from '../../components/shared/MetricStackBar'
import type { CockpitData } from '../../types/cockpit'
import { comparisonRangeLabel } from '../../utils/comparisonRange'
import { money } from './CockpitCommandWidgets'

interface Props {
  data: CockpitData
  onNavigate: (route: string) => void
}

const chartColors = [
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-info)',
]

export function CockpitStoreCommandBoard({ data, onNavigate }: Props) {
  const stores = data.sections.store_matrix.items
  const platformRows = platformBreakdown(stores)
  const displayStores = [...stores]
    .sort((a, b) => (b.order_count + b.active_listings) - (a.order_count + a.active_listings))
    .slice(0, 8)
  const storeRows = displayStores
    .map((store) => ({
      id: store.id,
      name: store.account_name,
      platform: store.platform,
      orders: store.order_count,
      listings: store.active_listings,
      revenue: store.revenue_rmb ?? 0,
      cost: store.cost_rmb ?? 0,
      profit: store.net_profit_rmb ?? 0,
      contribution: contributionValue(store, data.sections.store_matrix.metrics.order_count, data.sections.store_matrix.metrics.active_listings),
    }))
  const storeFinanceRows = displayStores
    .filter((store) => store.ledger_entry_count > 0 || store.revenue_rmb != null || store.cost_rmb != null || store.net_profit_rmb != null)
    .map((store) => ({
      name: store.account_name,
      revenue: store.revenue_rmb ?? 0,
      cost: store.cost_rmb ?? 0,
      profit: store.net_profit_rmb ?? 0,
    }))
  const shareRows = platformRows.map((row) => ({ name: row.platform, value: row.orders || row.listings }))
  const comparison = data.comparison
  const comparisonRows = [
    { period: comparisonRangeLabel('current', comparison.windows.current), window: comparison.windows.current, orders: comparison.current.orders, revenue: comparison.current.revenue_rmb ?? 0, profit: comparison.current.net_profit_rmb ?? 0 },
    { period: comparisonRangeLabel('previous', comparison.windows.previous), window: comparison.windows.previous, orders: comparison.previous.orders, revenue: comparison.previous.revenue_rmb ?? 0, profit: comparison.previous.net_profit_rmb ?? 0 },
    { period: comparisonRangeLabel('lastYear', comparison.windows.last_year), window: comparison.windows.last_year, orders: comparison.last_year.orders, revenue: comparison.last_year.revenue_rmb ?? 0, profit: comparison.last_year.net_profit_rmb ?? 0 },
  ]
  const currentWindow = comparison.windows.current || data.sections.orders.evidence_window
  const topStore = storeRows[0]
  const profitMargin = comparison.current.revenue_rmb && comparison.current.net_profit_rmb != null
    ? Number(((comparison.current.net_profit_rmb / comparison.current.revenue_rmb) * 100).toFixed(1))
    : null
  const topPlatform = platformRows[0]

  return (
    <section aria-label="平台店铺经营总分看板" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">platform store command</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--color-fg)]">公司 → 平台 → 店铺经营总览</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            先看公司当前经营日期范围，再下钻平台和店铺：订单、Listing、收入、投入、净利和同步状态必须能在同一张经营图上解释清楚。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">平台 {data.sections.store_matrix.metrics.platform_count}</Badge>
          <Badge variant="outline">店铺 {data.sections.store_matrix.metrics.store_count}</Badge>
          <Badge variant="outline">经营范围 {currentWindow}</Badge>
        </div>
      </div>

      <section
        aria-label="公司级经营总览"
        data-ui="operating-hero"
        className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)]"
      >
        <div
          className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]"
          style={{ background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-bg) 42%, var(--color-surface))' }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">公司级经营总览</span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">{currentWindow}</span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-[var(--color-fg)]">先看公司经营结果，再下钻平台和店铺</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              这个区域只回答经营管理最先要看的问题：当前日期范围卖了多少、赚了多少、覆盖多少平台店铺、主力店铺是谁，以及下一步应该进入商品、订单还是财务。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <HeroMetric label="经营覆盖" value={`${data.sections.store_matrix.metrics.active_store_count}/${data.sections.store_matrix.metrics.store_count}`} detail={`平台 ${data.sections.store_matrix.metrics.platform_count} · Listing ${data.sections.store_matrix.metrics.active_listings}`} />
              <HeroMetric label="资金质量" value={profitMargin == null ? '待核算' : `${profitMargin}%`} detail={`收入 ${money(comparison.current.revenue_rmb)} · 净利 ${money(comparison.current.net_profit_rmb)}`} tone={profitMargin != null && profitMargin < 0 ? 'danger' : 'primary'} />
              <HeroMetric label="主力店铺" value={topStore ? topStore.name : '待形成'} detail={topStore ? `${topStore.platform} · 贡献 ${topStore.contribution}%` : '授权店铺、同步商品和订单后形成'} />
            </div>
          </div>

          <aside aria-label="经营下钻动作" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">经营下钻动作</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">围绕当前经营结果进入真实业务对象，避免停留在指标卡片。</p>
              </div>
              <Badge variant={comparison.current.orders > 0 ? 'success' : 'warning'}>订单 {comparison.current.orders}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              <HeroAction
                label="查看店铺商品"
                detail={topStore ? `${topStore.name} 商品和 Listing` : '进入平台店铺商品库'}
                onClick={() => onNavigate(topStore ? `/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(topStore.id)}&platform=${encodeURIComponent(topStore.platform)}` : '/products?tab=platform_store_products')}
              />
              <HeroAction
                label="核对订单履约"
                detail={topStore ? `${topStore.name} 订单与履约状态` : '查看全部平台店铺订单'}
                onClick={() => onNavigate(topStore ? `/orders?platform_account_id=${encodeURIComponent(topStore.id)}` : '/orders')}
              />
              <HeroAction
                label="复核利润资金"
                detail={topStore ? `${topStore.name} 收入、投入和净利` : '查看公司级财务利润'}
                onClick={() => onNavigate(topStore ? `/finance?platform_account_id=${encodeURIComponent(topStore.id)}` : '/finance')}
              />
              <HeroAction
                label="管理平台店铺"
                detail={topPlatform ? `${topPlatform.platform} 当前贡献最高` : '配置 Shopee / TEMU / TikTok Shop'}
                onClick={() => onNavigate('/platforms')}
              />
            </div>
          </aside>
        </div>
      </section>

      <ComparisonRangeCards
        ariaLabel="经营对比范围说明"
        scopeLabel="经营"
        windows={comparison.windows}
        descriptions={{
          current: '所选起止日期内的实际经营结果；未选择日期时系统默认最近 30 个自然日。',
          previous: '统计区间之前同样天数的经营结果，用于环比。',
          lastYear: '统计区间起止日期整体向前平移一年，用于同比；缺数据时显示待补。',
        }}
      />

      <CommandInsightStrip
        ariaLabel="经营核心判断条"
        title="经营核心判断"
        subtitle="先把公司级结果、店铺贡献和资金质量讲清楚，再进入下方图表和店铺明细。"
        items={[
          {
            label: '公司经营结果',
            value: money(comparison.current.revenue_rmb),
            insight: `统计区间订单 ${comparison.current.orders} 单，净利 ${money(comparison.current.net_profit_rmb)}；收入、订单和利润必须一起看，避免只看单量不看资金质量。`,
            tone: comparison.current.net_profit_rmb != null && comparison.current.net_profit_rmb < 0 ? 'danger' : 'success',
            actionLabel: '查看财务明细',
            onAction: () => onNavigate('/finance'),
          },
          {
            label: '店铺贡献最高',
            value: topStore ? topStore.name : '待形成',
            insight: topStore
              ? `${topStore.platform} 店铺贡献 ${topStore.contribution}%；继续下钻该店铺商品、订单和资金，判断是否具备放量条件。`
              : '当前还没有可排序的店铺经营数据，需要先完成平台店铺授权、商品同步和订单同步。',
            tone: topStore ? 'primary' : 'warning',
            actionLabel: topStore ? '下钻店铺商品' : '配置平台店铺',
            onAction: () => onNavigate(topStore ? `/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(topStore.id)}&platform=${encodeURIComponent(topStore.platform)}` : '/platforms'),
          },
          {
            label: '利润率口径',
            value: profitMargin == null ? '待核算' : `${profitMargin}%`,
            insight: profitMargin == null
              ? '收入或净利台账不足，不能给出利润率结论；需要补齐平台账单、采购成本、物流和广告费用。'
              : `净利率按统计区间收入和净利润计算；低于目标时优先核对定价、平台费用、广告和采购成本。`,
            tone: profitMargin == null ? 'warning' : profitMargin < 0 ? 'danger' : 'info',
            actionLabel: '检查成本利润',
            onAction: () => onNavigate('/finance?view=traceback'),
          },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-4">
        <SummaryTile icon={<Store className="h-4 w-4" />} label="全部店铺" value={`${data.sections.store_matrix.metrics.active_store_count}/${data.sections.store_matrix.metrics.store_count}`} sub="活跃/总店铺" />
        <SummaryTile icon={<TrendingUp className="h-4 w-4" />} label="范围内订单" value={String(comparison.current.orders)} sub={<RateText mom={comparison.rates.orders_mom_pct} yoy={comparison.rates.orders_yoy_pct} />} />
        <SummaryTile icon={<WalletCards className="h-4 w-4" />} label="范围内收入" value={money(comparison.current.revenue_rmb)} sub={<RateText mom={comparison.rates.revenue_mom_pct} yoy={comparison.rates.revenue_yoy_pct} />} />
        <SummaryTile icon={<WalletCards className="h-4 w-4" />} label="范围内净利润" value={money(comparison.current.net_profit_rmb)} sub={<RateText mom={comparison.rates.profit_mom_pct} yoy={comparison.rates.profit_yoy_pct} />} danger={comparison.current.net_profit_rmb != null && comparison.current.net_profit_rmb < 0} />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">店铺资金分布</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">分店铺展示收入、投入/成本和净利；只统计明确绑定店铺的财务台账。</p>
          </div>
          <Badge variant="outline">绑定台账 {data.sections.store_matrix.metrics.ledger_entry_count}</Badge>
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
                      <td className="px-3 py-2 text-[var(--color-muted)]">{store.platform} · {store.market || '市场待补'}</td>
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
    </section>
  )
}

function HeroMetric({ label, value, detail, tone = 'primary' }: { label: string; value: string; detail: string; tone?: 'primary' | 'danger' }) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold" style={{ color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-fg)' }}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </article>
  )
}

function HeroAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
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

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">{text}</div>
}

function platformBreakdown(stores: CockpitData['sections']['store_matrix']['items']) {
  const map = new Map<string, { platform: string; stores: number; orders: number; listings: number }>()
  for (const store of stores) {
    const row = map.get(store.platform) || { platform: store.platform, stores: 0, orders: 0, listings: 0 }
    row.stores += 1
    row.orders += store.order_count
    row.listings += store.active_listings
    map.set(store.platform, row)
  }
  return [...map.values()].sort((a, b) => (b.orders + b.listings) - (a.orders + a.listings))
}

function contributionValue(store: CockpitData['sections']['store_matrix']['items'][number], totalOrders: number, totalListings: number) {
  if (totalOrders > 0) return Number(((store.order_count / totalOrders) * 100).toFixed(1))
  if (totalListings > 0) return Number(((store.active_listings / totalListings) * 100).toFixed(1))
  return 0
}

function revenueText(values: { currency: string; orders: number; revenue: number }[]) {
  if (values.length === 0) return ''
  return values.slice(0, 2).map((item) => `${item.currency} ${item.revenue.toLocaleString()} / ${item.orders}单`).join('；')
}

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  background: 'var(--color-surface)',
  color: 'var(--color-fg)',
}
