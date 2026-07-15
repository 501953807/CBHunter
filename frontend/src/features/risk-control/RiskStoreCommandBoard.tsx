import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ShieldAlert, Store, TimerReset } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { CommandInsightStrip } from '../../components/shared/CommandInsightStrip'
import { ComparisonRangeCards } from '../../components/shared/ComparisonRangeCards'
import { MetricStackBar } from '../../components/shared/MetricStackBar'
import type { RiskControlOverview } from '../../types/riskControl'
import { comparisonRangeLabel } from '../../utils/comparisonRange'

interface Props {
  data: RiskControlOverview
  onNavigate: (route: string) => void
}

const chartColors = [
  'var(--color-danger)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-primary)',
  'var(--color-success)',
]

export function RiskStoreCommandBoard({ data, onNavigate }: Props) {
  const platformRows = data.risk_platform_matrix
  const storeRows = data.risk_store_matrix.slice(0, 8)
  const categoryRows = data.risk_radar.map((item) => ({
    name: item.label.replace('风险', ''),
    score: item.score,
    active: item.active_count,
    critical: item.critical,
  }))
  const pieRows = platformRows.map((item) => ({ name: item.platform, value: item.total }))
  const comparisonRows = [
    { period: comparisonRangeLabel('current', data.comparison.windows.current), window: data.comparison.windows.current, active: data.comparison.current.active, critical: data.comparison.current.critical, warning: data.comparison.current.warning },
    { period: comparisonRangeLabel('previous', data.comparison.windows.previous), window: data.comparison.windows.previous, active: data.comparison.previous.active, critical: data.comparison.previous.critical, warning: data.comparison.previous.warning },
    { period: comparisonRangeLabel('lastYear', data.comparison.windows.last_year), window: data.comparison.windows.last_year, active: data.comparison.last_year.active, critical: data.comparison.last_year.critical, warning: data.comparison.last_year.warning },
  ]
  const currentWindow = data.comparison.windows.current || '风险日期范围待补'
  const topRiskPlatform = [...platformRows].sort((a, b) => b.total - a.total)[0]
  const topRiskStore = [...data.risk_store_matrix].sort((a, b) => b.total - a.total)[0]
  const urgentRiskCount = data.metrics.overdue + data.comparison.current.critical
  const riskPriority = urgentRiskCount > 0 ? '立即处置' : data.comparison.current.warning > 0 ? '今日复核' : '持续监控'

  return (
    <section aria-label="平台店铺风险总分看板" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">risk command</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-fg)]">平台店铺风险总览</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">总看全部平台/店铺规则风险和经营风险，分看每个平台、每个店铺的高危、警告、逾期、预计影响和剩余处理时间。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={data.metrics.critical ? 'danger' : data.metrics.warning ? 'warning' : 'success'}>活跃风险 {data.comparison.current.active}</Badge>
          <Badge variant="outline">风险范围 {currentWindow}</Badge>
        </div>
      </div>

      <section
        aria-label="风险处置总览"
        data-ui="risk-hero"
        className="mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)]"
      >
        <div
          className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]"
          style={{ background: 'linear-gradient(135deg, var(--color-danger), var(--color-bg) 36%, var(--color-surface))' }}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-danger)]">风险处置总览</span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)]">{currentWindow}</span>
            </div>
            <h3 className="mt-3 text-2xl font-bold text-[var(--color-fg)]">先处理高危和逾期，再下钻到平台、店铺、订单和商品</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              风险管控台首屏只回答处置问题：现在要先处理什么、风险集中在哪个店铺、有没有即将超时或已经逾期，以及下一步进入哪个业务对象。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <RiskHeroMetric label="处置优先级" value={riskPriority} detail={`高危 ${data.comparison.current.critical} · 逾期 ${data.metrics.overdue} · 警告 ${data.comparison.current.warning}`} tone={urgentRiskCount > 0 ? 'danger' : data.comparison.current.warning > 0 ? 'warning' : 'primary'} />
              <RiskHeroMetric label="最高风险店铺" value={topRiskStore ? topRiskStore.account_name : topRiskPlatform?.platform || '待定位'} detail={topRiskStore ? `${topRiskStore.platform} · ${topRiskStore.total} 项风险` : topRiskPlatform ? `${topRiskPlatform.platform} · ${topRiskPlatform.total} 项风险` : '暂无可定位风险'} tone={topRiskStore?.critical || topRiskPlatform?.critical ? 'danger' : 'primary'} />
              <RiskHeroMetric label="即将超时" value={`${data.metrics.overdue} 项逾期`} detail={`处理中 ${data.metrics.processing} · 待处理 ${data.metrics.pending}`} tone={data.metrics.overdue > 0 ? 'danger' : 'primary'} />
            </div>
          </div>

          <aside aria-label="风险处置动作" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-fg)]">风险处置动作</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">从风险总览直接进入可处理对象，避免只看风险数量。</p>
              </div>
              <Badge variant={urgentRiskCount > 0 ? 'danger' : data.comparison.current.warning > 0 ? 'warning' : 'success'}>{riskPriority}</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              <RiskHeroAction
                label="查看风险队列"
                detail={`活跃 ${data.comparison.current.active} · 高危 ${data.comparison.current.critical}`}
                onClick={() => onNavigate('/risk')}
              />
              <RiskHeroAction
                label="处理异常订单"
                detail={topRiskStore ? `${topRiskStore.account_name} 订单风险` : '查看全部异常订单'}
                onClick={() => onNavigate(topRiskStore?.platform_account_id ? `/orders?platform_account_id=${encodeURIComponent(topRiskStore.platform_account_id)}&exceptions=1` : '/orders?exceptions=1')}
              />
              <RiskHeroAction
                label="复核店铺商品"
                detail={topRiskStore ? `${topRiskStore.account_name} 商品和 Listing` : '进入平台店铺商品库'}
                onClick={() => onNavigate(topRiskStore?.platform_account_id ? `/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(topRiskStore.platform_account_id)}&platform=${encodeURIComponent(topRiskStore.platform)}` : '/products?tab=platform_store_products')}
              />
              <RiskHeroAction
                label="检查平台配置"
                detail={topRiskPlatform ? `${topRiskPlatform.platform} 风险最多` : '检查 Shopee / TEMU / TikTok Shop 接入'}
                onClick={() => onNavigate('/platforms')}
              />
            </div>
          </aside>
        </div>
      </section>

      <ComparisonRangeCards
        ariaLabel="风险对比范围说明"
        scopeLabel="风险"
        windows={data.comparison.windows}
        descriptions={{
          current: '所选起止日期内正在影响平台、店铺、订单、Listing 或资金的风险压力。',
          previous: '统计区间之前同样天数的风险压力，用于识别风险是否正在积累或缓解。',
          lastYear: '统计区间起止日期整体向前平移一年，用于观察季节性平台规则或履约风险。',
        }}
      />

      <CommandInsightStrip
        ariaLabel="风险核心判断条"
        title="风险核心判断"
        subtitle="先判断风险压力、逾期处理和最高风险归属，再进入雷达、平台和店铺热力。"
        items={[
          {
            label: '风险压力',
            value: `${data.comparison.current.active} 项`,
            insight: `统计区间高危 ${data.comparison.current.critical} 项、警告 ${data.comparison.current.warning} 项；高危和逾期优先于普通规则提醒。`,
            tone: data.comparison.current.critical > 0 ? 'danger' : data.comparison.current.warning > 0 ? 'warning' : 'success',
            actionLabel: '查看风险队列',
            onAction: () => onNavigate('/risk'),
          },
          {
            label: '逾期处理',
            value: `${data.metrics.overdue} 项`,
            insight: data.metrics.overdue > 0
              ? '存在超过处理时限的风险，优先核对平台订单、履约 SLA 和店铺规则处罚。'
              : '暂无逾期风险；继续关注即将到期的订单履约、资金投入和 Listing 表现风险。',
            tone: data.metrics.overdue > 0 ? 'danger' : 'success',
            actionLabel: '处理异常订单',
            onAction: () => onNavigate('/orders?exceptions=1'),
          },
          {
            label: '最高风险归属',
            value: topRiskStore ? topRiskStore.account_name : topRiskPlatform?.platform || '待定位',
            insight: topRiskStore
              ? `${topRiskStore.platform} · ${topRiskStore.market || '市场待补'}，累计 ${topRiskStore.total} 项风险；必须能下钻到店铺、订单、商品或资金记录。`
              : topRiskPlatform ? `${topRiskPlatform.platform} 平台累计 ${topRiskPlatform.total} 项风险；需要继续补齐店铺归属。` : '暂无可定位的平台或店铺风险。',
            tone: topRiskStore?.critical || topRiskPlatform?.critical ? 'danger' : 'info',
            actionLabel: topRiskStore?.platform_account_id ? '下钻店铺风险' : '查看平台管理',
            onAction: () => onNavigate(topRiskStore?.platform_account_id ? `/orders?platform_account_id=${encodeURIComponent(topRiskStore.platform_account_id)}&exceptions=1` : '/platforms'),
          },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryTile icon={<ShieldAlert className="h-4 w-4" />} label="范围内活跃风险" value={String(data.comparison.current.active)} sub={<RateText mom={data.comparison.rates.active_mom_pct} yoy={data.comparison.rates.active_yoy_pct} />} danger={data.comparison.current.active > 0} />
        <SummaryTile icon={<ShieldAlert className="h-4 w-4" />} label="范围内高危风险" value={String(data.comparison.current.critical)} sub={<RateText mom={data.comparison.rates.critical_mom_pct} yoy={data.comparison.rates.critical_yoy_pct} />} danger={data.comparison.current.critical > 0} />
        <SummaryTile icon={<TimerReset className="h-4 w-4" />} label="逾期风险" value={String(data.metrics.overdue)} sub="按 SLA 到期时间识别" danger={data.metrics.overdue > 0} />
        <SummaryTile icon={<Store className="h-4 w-4" />} label="涉及店铺" value={String(data.risk_store_matrix.length)} sub="已定位平台店铺风险" danger={data.risk_store_matrix.some((item) => item.account_name === '待定位店铺')} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-fg)]">风险范围对比</p>
            <span className="text-[11px] text-[var(--color-muted)]">图例显示天数，悬停看起止日期</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={comparisonRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.window || ''} />
              <Bar dataKey="active" name="活跃风险" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" name="高危风险" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warning" name="警告风险" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-fg)]">平台风险分布</p>
            <span className="text-[11px] text-[var(--color-muted)]">按平台汇总高危/警告/逾期</span>
          </div>
          {platformRows.length === 0 ? (
            <EmptyChart text="暂无可定位平台风险" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="critical" name="高危" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="warning" name="警告" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overdue" name="逾期" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 xl:col-span-2">
          <p className="mb-2 text-sm font-semibold text-[var(--color-fg)]">平台风险占比</p>
          {pieRows.every((row) => row.value === 0) ? (
            <EmptyChart text="暂无风险占比" />
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-fg)]">风险类型雷达图</p>
            <span className="text-[11px] text-[var(--color-muted)]">评分越外圈，风险压力越高</span>
          </div>
          {categoryRows.length === 0 ? (
            <EmptyChart text="暂无风险类型评分" />
          ) : (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={categoryRows} outerRadius="72%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                  <Radar name="风险评分" dataKey="score" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.22} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid content-start gap-2">
                {categoryRows.map((row) => (
                  <div key={row.name} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--color-fg)]">{row.name}</span>
                      <span className="text-xs font-semibold text-[var(--color-danger)]">{row.score}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">活跃 {row.active} · 高危 {row.critical}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-fg)]">风险类型排行</p>
            <span className="text-[11px] text-[var(--color-muted)]">用于处置优先级排序</span>
          </div>
          {categoryRows.length === 0 ? (
            <EmptyChart text="暂无风险类型排行" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, categoryRows.length * 38)}>
              <BarChart data={categoryRows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} stroke="var(--color-muted)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="score" name="风险评分" fill="var(--color-danger)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 xl:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-fg)]">店铺风险热力</p>
            <button className="text-xs text-[var(--color-primary)] hover:underline" onClick={() => onNavigate('/platforms')}>查看平台店铺</button>
          </div>
          {storeRows.length === 0 ? (
            <EmptyChart text="暂无店铺风险热力" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--color-surface)] text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">平台/店铺</th>
                    <th className="px-3 py-2 font-medium">高危</th>
                    <th className="px-3 py-2 font-medium">警告</th>
                    <th className="px-3 py-2 font-medium">逾期</th>
                    <th className="px-3 py-2 font-medium">风险热度</th>
                    <th className="px-3 py-2 font-medium">状态</th>
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
                      <td className="px-3 py-2 text-[var(--color-danger)]">{store.critical}</td>
                      <td className="px-3 py-2 text-[var(--color-warning)]">{store.warning}</td>
                      <td className="px-3 py-2 text-[var(--color-danger)]">{store.overdue}</td>
                      <td className="px-3 py-2">
                        <MetricStackBar
                          ariaLabel="店铺风险热度结构"
                          segments={[
                            { label: '高危', value: store.critical, color: 'var(--color-danger)' },
                            { label: '警告', value: store.warning, color: 'var(--color-warning)' },
                            { label: '处理中', value: store.processing, color: 'var(--color-info)' },
                          ]}
                          emptyLabel="暂无活跃风险"
                        />
                      </td>
                      <td className="px-3 py-2"><Badge variant={store.critical ? 'danger' : store.warning ? 'warning' : 'info'}>{store.total} 项</Badge></td>
                      <td className="px-3 py-2 text-right">
                        {store.platform_account_id ? (
                          <div className="flex justify-end gap-2">
                            <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/orders?platform_account_id=${encodeURIComponent(store.platform_account_id || '')}&exceptions=1`)}>风险订单</button>
                            <button className="text-[var(--color-primary)] hover:underline" onClick={() => onNavigate(`/products?tab=platform_store_products&platform_account_id=${encodeURIComponent(store.platform_account_id || '')}&platform=${encodeURIComponent(store.platform)}`)}>店铺商品</button>
                          </div>
                        ) : <span className="text-[var(--color-muted)]">待定位</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function RiskHeroMetric({ label, value, detail, tone = 'primary' }: { label: string; value: string; detail: string; tone?: 'primary' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </article>
  )
}

function RiskHeroAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition hover:border-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--color-fg)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{detail}</span>
      </span>
      <ArrowUpRight className="h-4 w-4 text-[var(--color-danger)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
    <span className={positive ? 'inline-flex items-center gap-0.5 text-[var(--color-danger)]' : 'inline-flex items-center gap-0.5 text-[var(--color-success)]'}>
      <Icon className="h-3 w-3" />
      {label}{Math.abs(value)}%
    </span>
  )
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
