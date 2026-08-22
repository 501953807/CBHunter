import { Badge } from '../../components/ui/Badge'
import { CommandInsightStrip } from '../../components/shared/CommandInsightStrip'
import { ComparisonRangeCards } from '../../components/shared/ComparisonRangeCards'
import type { CockpitData } from '../../types/cockpit'
import { comparisonRangeLabel } from '../../utils/comparisonRange'
import { money } from './CockpitCommandWidgets'
import {
  HeroAction,
  HeroMetric,
  NegativeProfitAlert,
  OperatingComparisonPanels,
  StoreContributionRanking,
  StoreFinanceDistributionPanel,
  StoreSummaryTiles,
} from './CockpitStoreCommandBoardParts'

interface Props {
  data: CockpitData
  onNavigate: (route: string) => void
}

export function CockpitStoreCommandBoard({ data, onNavigate }: Props) {
  const stores = data.sections.store_matrix.items
  const metrics = data.sections.store_matrix.metrics
  const platformRows = platformBreakdown(stores)
  const displayStores = [...stores]
    .sort((a, b) => (b.order_count + b.active_listings) - (a.order_count + a.active_listings))
    .slice(0, 8)
  const storeRows = displayStores.map((store) => ({
    id: store.id,
    name: store.account_name,
    platform: store.platform,
    orders: store.order_count,
    listings: store.active_listings,
    revenue: store.revenue_rmb ?? 0,
    cost: store.cost_rmb ?? 0,
    profit: store.net_profit_rmb ?? 0,
    contribution: contributionValue(store, metrics.order_count, metrics.active_listings),
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
    {
      period: comparisonRangeLabel('current', comparison.windows.current),
      window: comparison.windows.current,
      orders: comparison.current.orders,
      revenue: comparison.current.revenue_rmb ?? 0,
      profit: comparison.current.net_profit_rmb ?? 0,
    },
    {
      period: comparisonRangeLabel('previous', comparison.windows.previous),
      window: comparison.windows.previous,
      orders: comparison.previous.orders,
      revenue: comparison.previous.revenue_rmb ?? 0,
      profit: comparison.previous.net_profit_rmb ?? 0,
    },
    {
      period: comparisonRangeLabel('lastYear', comparison.windows.last_year),
      window: comparison.windows.last_year,
      orders: comparison.last_year.orders,
      revenue: comparison.last_year.revenue_rmb ?? 0,
      profit: comparison.last_year.net_profit_rmb ?? 0,
    },
  ]
  const currentWindow = comparison.windows.current || data.sections.orders.evidence_window
  const topStore = storeRows[0]
  const topPlatform = platformRows[0]
  const profitMargin = comparison.current.revenue_rmb && comparison.current.net_profit_rmb != null
    ? Number(((comparison.current.net_profit_rmb / comparison.current.revenue_rmb) * 100).toFixed(1))
    : null
  const negativeProfitStores = stores.filter((store) => (store.net_profit_rmb ?? 0) < 0)
  const hasNegativeProfit = (comparison.current.net_profit_rmb ?? 0) < 0 || negativeProfitStores.length > 0

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
          <Badge variant="outline">平台 {metrics.platform_count}</Badge>
          <Badge variant="outline">店铺 {metrics.store_count}</Badge>
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
              <HeroMetric label="经营覆盖" value={`${metrics.active_store_count}/${metrics.store_count}`} detail={`平台 ${metrics.platform_count} · Listing ${metrics.active_listings}`} />
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
                label="复核店铺物流"
                detail={topStore ? `${topStore.name} 发货记录与物流状态` : '查看全部平台店铺物流'}
                onClick={() => onNavigate(topStore ? `/shipments?platform_account_id=${encodeURIComponent(topStore.id)}&platform=${encodeURIComponent(topStore.platform)}` : '/shipments')}
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
              : '净利率按统计区间收入和净利润计算；低于目标时优先核对定价、平台费用、广告和采购成本。',
            tone: profitMargin == null ? 'warning' : profitMargin < 0 ? 'danger' : 'info',
            actionLabel: '检查成本利润',
            onAction: () => onNavigate('/finance?view=traceback'),
          },
        ]}
      />

      {hasNegativeProfit ? (
        <NegativeProfitAlert
          totalProfit={comparison.current.net_profit_rmb}
          stores={negativeProfitStores}
          onNavigate={onNavigate}
        />
      ) : null}

      <StoreSummaryTiles comparison={comparison} metrics={metrics} />
      <StoreFinanceDistributionPanel ledgerEntryCount={metrics.ledger_entry_count} storeFinanceRows={storeFinanceRows} />
      <OperatingComparisonPanels
        comparisonRows={comparisonRows}
        currentWindow={currentWindow}
        onNavigate={onNavigate}
        platformRows={platformRows}
        shareRows={shareRows}
      />
      <StoreContributionRanking displayStores={displayStores} onNavigate={onNavigate} storeRows={storeRows} />
    </section>
  )
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
