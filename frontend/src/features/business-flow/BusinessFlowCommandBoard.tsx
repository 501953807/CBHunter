import type { ReactNode } from 'react'
import { ArrowRight, GitBranch, PackageCheck, ShieldAlert, Store } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { CommandInsightStrip } from '../../components/shared/CommandInsightStrip'
import { ComparisonRangeCards } from '../../components/shared/ComparisonRangeCards'
import { MetricStackBar } from '../../components/shared/MetricStackBar'
import type { BusinessFlowOverview } from '../../types/businessFlow'
import { comparisonRangeLabel } from '../../utils/comparisonRange'
import { buildObjectRoute } from './businessFlowRoutes'

interface Props {
  data: BusinessFlowOverview
  onNavigate: (route: string) => void
}

const chartColors = [
  'var(--color-primary)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-info)',
  'var(--color-success)',
]

export function BusinessFlowCommandBoard({ data, onNavigate }: Props) {
  const stageRows = data.flow_stage_matrix
  const platformRows = data.flow_platform_matrix
  const storeRows = data.flow_store_matrix.slice(0, 8)
  const pieRows = platformRows.map((item) => ({ name: item.platform, value: item.object_count }))
  const comparisonRows = [
    { period: comparisonRangeLabel('current', data.comparison.windows.current), window: data.comparison.windows.current, items: data.comparison.current.items, blocked: data.comparison.current.blocked, dataRequired: data.comparison.current.data_required },
    { period: comparisonRangeLabel('previous', data.comparison.windows.previous), window: data.comparison.windows.previous, items: data.comparison.previous?.items ?? 0, blocked: data.comparison.previous?.blocked ?? 0, dataRequired: data.comparison.previous?.data_required ?? 0 },
    { period: comparisonRangeLabel('lastYear', data.comparison.windows.last_year), window: data.comparison.windows.last_year, items: data.comparison.last_year?.items ?? 0, blocked: data.comparison.last_year?.blocked ?? 0, dataRequired: data.comparison.last_year?.data_required ?? 0 },
  ]
  const stageDwellRows = [...data.comparison.stage_dwell].sort((a, b) => (b.current.avg_wait_hours ?? -1) - (a.current.avg_wait_hours ?? -1))
  const currentWindow = data.comparison.windows.current || '业务日期范围待补'
  const bottleneckStage = [...stageRows].sort((a, b) => ((b.blocked + b.data_required) - (a.blocked + a.data_required)))[0]
  const primaryAction = data.next_actions.find((action) => action.primary) || data.next_actions[0]
  const blockedRate = data.comparison.current.items
    ? Number((((data.comparison.current.blocked + data.comparison.current.data_required) / data.comparison.current.items) * 100).toFixed(1))
    : null
  const topBlockedStore = [...data.flow_store_matrix].sort((a, b) => ((b.blocked + b.data_required) - (a.blocked + a.data_required)))[0]
  const flowPriority = blockedRate == null ? '待形成' : blockedRate > 30 ? '立即疏通' : blockedRate > 10 ? '今日处理' : '正常推进'
  const primaryActionRoute = primaryAction ? buildObjectRoute(primaryAction.route, primaryAction) : '/business-flow'

  return (
    <section aria-label="业务流程总分看板" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">flow command</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">业务流程卡点总览</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            总看全部平台/店铺业务对象推进状态，分看八个关键阶段、平台、店铺的卡点密度和下一步处理入口。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={data.metrics.item_blocked ? 'danger' : data.metrics.item_data_required ? 'warning' : 'success'}>对象 {data.comparison.current.items}</Badge>
          <Badge variant="outline">业务范围 {currentWindow}</Badge>
        </div>
      </div>

      <section
        aria-label="业务处理总览"
        data-ui="flow-hero"
        className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)]"
      >
        <div
          className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]"
          style={{ background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-bg) 42%, var(--color-surface))' }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">业务处理总览</span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">{currentWindow}</span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-[var(--color-fg)]">先定位当前瓶颈，再进入具体业务对象处理</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              业务监控台首屏只回答处理问题：链路卡在哪、缺什么资料、哪个店铺对象最多、下一步应该进入选品、Listing、定价、刊登还是订单履约。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <FlowHeroMetric label="当前瓶颈" value={bottleneckStage ? bottleneckStage.label : '待定位'} detail={bottleneckStage ? `阻塞 ${bottleneckStage.blocked} · 待补 ${bottleneckStage.data_required} · 平均停留 ${bottleneckStage.avg_wait_label}` : '暂无阶段矩阵数据'} tone={bottleneckStage && (bottleneckStage.blocked + bottleneckStage.data_required) > 0 ? 'warning' : 'primary'} />
              <FlowHeroMetric label="卡点率" value={blockedRate == null ? '待形成' : `${blockedRate}%`} detail={`业务对象 ${data.comparison.current.items} · 卡点 ${data.comparison.current.blocked} · 待补资料 ${data.comparison.current.data_required}`} tone={blockedRate == null ? 'warning' : blockedRate > 30 ? 'danger' : blockedRate > 10 ? 'warning' : 'primary'} />
              <FlowHeroMetric label="待补关键资料" value={`${data.comparison.current.data_required} 项`} detail={topBlockedStore ? `${topBlockedStore.account_name} 需优先处理` : '暂无店铺卡点归属'} tone={data.comparison.current.data_required > 0 ? 'warning' : 'primary'} />
            </div>
          </div>

          <aside aria-label="业务处理动作" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">业务处理动作</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">从瓶颈阶段进入真实处理对象，减少跨页面猜测。</p>
              </div>
              <Badge variant={blockedRate != null && blockedRate > 30 ? 'danger' : blockedRate != null && blockedRate > 10 ? 'warning' : 'success'}>{flowPriority}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              <FlowHeroAction
                label={primaryAction ? primaryAction.label : '进入处理总线'}
                detail={primaryAction ? primaryAction.reason : '查看当前业务对象和下一步动作'}
                onClick={() => onNavigate(primaryActionRoute)}
              />
              <FlowHeroAction
                label="进入当前瓶颈阶段"
                detail={bottleneckStage ? `${bottleneckStage.label} · ${bottleneckStage.object_count} 个对象` : '先补充业务对象'}
                onClick={() => onNavigate(bottleneckStage?.route || '/scout')}
              />
              <FlowHeroAction
                label="处理店铺对象"
                detail={topBlockedStore ? `${topBlockedStore.account_name} · 卡点 ${topBlockedStore.blocked + topBlockedStore.data_required}` : '进入平台店铺商品库'}
                onClick={() => onNavigate(topBlockedStore?.platform_account_id ? `/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(topBlockedStore.platform_account_id)}&platform=${encodeURIComponent(topBlockedStore.platform)}` : '/products?tab=platform_store_products')}
              />
              <FlowHeroAction
                label="查看业务处理总线"
                detail={`任务 ${data.metrics.task_count} · 分配给我 ${data.metrics.assigned_to_me}`}
                onClick={() => onNavigate('/business-flow')}
              />
            </div>
          </aside>
        </div>
      </section>

      <ComparisonRangeCards
        ariaLabel="业务对象对比范围说明"
        scopeLabel="业务对象"
        windows={data.comparison.windows}
        descriptions={{
          current: '所选起止日期内正在被系统跟踪的选品、商品、Listing、订单和运营对象。',
          previous: '统计区间之前同样天数的业务对象，用于识别卡点是否正在减少或积压。',
          lastYear: '统计区间起止日期整体向前平移一年，用于观察业务节奏、上架节奏和履约压力。',
        }}
      />

      <CommandInsightStrip
        ariaLabel="业务核心判断条"
        title="业务核心判断"
        subtitle="先判断链路吞吐、瓶颈阶段和下一步动作，再看八阶段矩阵和平台店铺热力。"
        items={[
          {
            label: '链路卡点率',
            value: blockedRate == null ? '待形成' : `${blockedRate}%`,
            insight: blockedRate == null
              ? '统计区间没有可追踪业务对象，需要先从选品、商品同步或内容制作产生对象。'
              : `卡点率 = 阻塞对象 + 待补资料对象 / 业务对象；高于目标时先处理缺标题、缺主图、缺平台属性和缺价格。`,
            tone: blockedRate == null ? 'warning' : blockedRate > 30 ? 'danger' : blockedRate > 10 ? 'warning' : 'success',
            actionLabel: '查看处理总线',
            onAction: () => onNavigate('/business-flow'),
          },
          {
            label: '当前瓶颈阶段',
            value: bottleneckStage ? bottleneckStage.label : '待定位',
            insight: bottleneckStage
              ? `${bottleneckStage.object_count} 个对象中，阻塞 ${bottleneckStage.blocked}、待补 ${bottleneckStage.data_required}、平均停留 ${bottleneckStage.avg_wait_label}；应直接进入该阶段补资料或处理卡点。`
              : '当前没有阶段矩阵数据，无法定位链路瓶颈。',
            tone: bottleneckStage && (bottleneckStage.blocked + bottleneckStage.data_required) > 0 ? 'warning' : 'success',
            actionLabel: bottleneckStage ? '进入瓶颈阶段' : '补充业务对象',
            onAction: () => onNavigate(bottleneckStage?.route || '/scout'),
          },
          {
            label: '下一步动作',
            value: primaryAction ? primaryAction.stage_label : '待生成',
            insight: primaryAction ? primaryAction.reason : '系统暂未生成可执行动作；需要补齐商品、Listing、订单或运营记录。',
            tone: primaryAction ? 'primary' : 'warning',
            actionLabel: primaryAction ? primaryAction.label : '去选品入口',
            onAction: () => onNavigate(primaryAction ? buildObjectRoute(primaryAction.route, primaryAction) : '/scout'),
          },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile icon={<GitBranch className="h-4 w-4" />} label="范围内业务对象" value={String(data.comparison.current.items)} sub="统计区间可追踪对象总数" />
        <SummaryTile icon={<ShieldAlert className="h-4 w-4" />} label="范围内卡点对象" value={String(data.comparison.current.blocked)} sub={<RateText mom={data.comparison.rates.blocked_mom_pct} yoy={data.comparison.rates.blocked_yoy_pct} />} danger={data.comparison.current.blocked > 0} />
        <SummaryTile icon={<PackageCheck className="h-4 w-4" />} label="范围内待补资料" value={String(data.comparison.current.data_required)} sub="缺关键字段或业务资料" danger={data.comparison.current.data_required > 0} />
        <SummaryTile icon={<Store className="h-4 w-4" />} label="涉及店铺" value={String(data.flow_store_matrix.length)} sub="已定位平台店铺对象" danger={data.flow_store_matrix.some((item) => item.account_name === '待定位店铺')} />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-fg)]">业务对象范围对比</p>
          <span className="text-[11px] text-[var(--color-muted)]">图例显示天数，悬停看起止日期</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={comparisonRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.window || ''} />
            <Bar dataKey="items" name="业务对象" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="blocked" name="卡点对象" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="dataRequired" name="待补对象" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">阶段停留对比</p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">按真实业务对象更新时间计算当前、环比、同比平均停留，定位哪个阶段正在拖慢上架链路。</p>
          </div>
          <Badge variant="outline">统计日期范围 / 环比日期范围 / 同比日期范围</Badge>
        </div>
        <div className="grid gap-2 lg:grid-cols-4">
          {stageDwellRows.map((stage) => (
            <button
              key={stage.key}
              type="button"
              onClick={() => onNavigate(stage.route)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-fg)]">{stage.label}</p>
                <span className="text-[11px] text-[var(--color-muted)]">{formatComparisonRate(stage.rates.avg_wait_mom_pct)}</span>
              </div>
              <p className="mt-2 text-xl font-bold text-[var(--color-fg)]">{stage.current.avg_wait_label}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                环比 {stage.previous.avg_wait_label} · 同比 {stage.last_year.avg_wait_label}
              </p>
              <p className="mt-2 truncate text-[11px] text-[var(--color-muted)]" title={stage.current.max_wait_item?.name || ''}>
                最长停留 {stage.current.max_wait_item ? `${stage.current.max_wait_item.wait_label} · ${stage.current.max_wait_item.name}` : '待形成'}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-fg)]">八阶段卡点矩阵</p>
          <span className="text-[11px] text-[var(--color-muted)]">信号收集 → 候选验证 → 选品决策 → Listing 制作 → 定价策略 → 平台刊登 → 订单履约 → 运营优化</span>
        </div>
        <div className="grid gap-2 xl:grid-cols-8">
          {stageRows.map((stage, index) => {
            const blocked = stage.blocked + stage.data_required
            return (
              <button key={stage.key} onClick={() => onNavigate(stage.route)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">{index + 1}</span>
                <p className="mt-2 truncate text-xs font-semibold text-[var(--color-fg)]">{stage.label}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <span className="block h-full rounded-full" style={{ width: `${stage.object_count ? Math.max(8, (stage.ready / stage.object_count) * 100) : 4}%`, background: blocked ? 'var(--color-warning)' : 'var(--color-success)' }} />
                </div>
                <p className={blocked ? 'mt-1.5 text-[11px] text-[var(--color-warning)]' : 'mt-1.5 text-[11px] text-[var(--color-muted)]'}>
                  {stage.object_count} 对象 · 卡点 {blocked}
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-muted)]">平均停留 {stage.avg_wait_label}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]" title={stage.max_wait_item?.name || ''}>
                  最长停留 {stage.max_wait_item ? `${stage.max_wait_item.wait_label} · ${stage.max_wait_item.name}` : '待形成'}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="mb-2 text-sm font-semibold text-[var(--color-fg)]">平台业务对象分布</p>
          {platformRows.length === 0 ? (
            <EmptyChart text="暂无可定位平台对象" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="ready" name="可推进" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="data_required" name="待补" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="blocked" name="阻塞" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <p className="mb-2 text-sm font-semibold text-[var(--color-fg)]">平台对象占比</p>
          {pieRows.every((row) => row.value === 0) ? (
            <EmptyChart text="暂无平台占比" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                  {pieRows.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-fg)]">店铺卡点热力</p>
          <span className="text-[11px] text-[var(--color-muted)]">优先处理阻塞和待补资料最多的店铺</span>
        </div>
        {storeRows.length === 0 ? (
          <EmptyChart text="暂无店铺业务热力" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">平台/店铺</th>
                  <th className="px-3 py-2 font-medium">对象</th>
                  <th className="px-3 py-2 font-medium">阻塞</th>
                  <th className="px-3 py-2 font-medium">待补</th>
                  <th className="px-3 py-2 font-medium">可推进</th>
                  <th className="px-3 py-2 font-medium">推进结构</th>
                  <th className="px-3 py-2 text-right font-medium">下钻</th>
                </tr>
              </thead>
              <tbody>
                {storeRows.map((store) => (
                  <tr key={`${store.platform}-${store.platform_account_id || store.account_name}`} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--color-fg)]">{store.account_name}</p>
                      <p className="mt-0.5 text-[var(--color-muted)]">{store.platform} · {store.market || '市场待补'}</p>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg)]">{store.object_count}</td>
                    <td className="px-3 py-2 text-[var(--color-danger)]">{store.blocked}</td>
                    <td className="px-3 py-2 text-[var(--color-warning)]">{store.data_required}</td>
                    <td className="px-3 py-2 text-[var(--color-success)]">{store.ready}</td>
                    <td className="px-3 py-2">
                      <MetricStackBar
                        ariaLabel="店铺业务推进结构"
                        segments={[
                          { label: '可推进', value: store.ready, color: 'var(--color-success)' },
                          { label: '待补', value: store.data_required, color: 'var(--color-warning)' },
                          { label: '阻塞', value: store.blocked, color: 'var(--color-danger)' },
                        ]}
                        emptyLabel="暂无业务对象"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {store.platform_account_id ? (
                        <button className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(store.platform_account_id || '')}&platform=${encodeURIComponent(store.platform)}`)}>
                          店铺对象 <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : <span className="text-[var(--color-muted)]">待定位</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function FlowHeroMetric({ label, value, detail, tone = 'primary' }: { label: string; value: string; detail: string; tone?: 'primary' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </article>
  )
}

function FlowHeroAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
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
      <ArrowRight className="h-4 w-4 text-[var(--color-primary)] transition group-hover:translate-x-0.5" />
    </button>
  )
}

function SummaryTile({ icon, label, value, sub, danger }: { icon: ReactNode; label: string; value: string; sub: ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className={danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 truncate text-xl font-bold" style={{ color: danger ? 'var(--color-danger)' : 'var(--color-fg)' }}>{value}</p>
      <div className="mt-1 text-[11px] text-[var(--color-muted)]">{sub}</div>
    </div>
  )
}

function RateText({ mom, yoy }: { mom: number | null; yoy: number | null }) {
  if (mom == null && yoy == null) return <span>环比/同比待业务对象时间序列补齐</span>
  return <span>环比 {mom ?? '待补'}% · 同比 {yoy ?? '待补'}%</span>
}

function formatComparisonRate(value: number | null) {
  if (value == null) return '环比待补'
  return value > 0 ? `环比 +${value}%` : `环比 ${value}%`
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">{text}</div>
}

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  background: 'var(--color-surface)',
  color: 'var(--color-fg)',
}
