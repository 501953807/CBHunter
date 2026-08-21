import type { ReactNode } from 'react'
import { ArrowRight, GitBranch, PackageCheck, ShieldAlert, Store } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '../../components/ui/Badge'
import { MetricStackBar } from '../../components/shared/MetricStackBar'
import type { BusinessFlowItem } from '../../types/businessFlow'
import { buildObjectRoute } from './businessFlowRoutes'

const chartColors = [
  'var(--color-primary)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-info)',
  'var(--color-success)',
]

const tooltipStyle = {
  borderRadius: '10px',
  border: '1px solid var(--color-border)',
  fontSize: '12px',
  background: 'var(--color-surface)',
  color: 'var(--color-fg)',
}

export function FlowHeroMetric({ label, value, detail, tone = 'primary' }: { label: string; value: string; detail: string; tone?: 'primary' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : tone === 'warning' ? 'var(--color-warning)' : 'var(--color-fg)'
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </article>
  )
}

export function FlowHeroAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
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

export function FlowSummaryTiles({
  blocked,
  dataRequired,
  itemCount,
  rates,
  storeRows,
}: {
  blocked: number
  dataRequired: number
  itemCount: number
  rates: { blocked_mom_pct: number | null; blocked_yoy_pct: number | null }
  storeRows: any[]
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SummaryTile icon={<GitBranch className="h-4 w-4" />} label="范围内业务对象" value={String(itemCount)} sub="统计区间可追踪对象总数" />
      <SummaryTile icon={<ShieldAlert className="h-4 w-4" />} label="范围内卡点对象" value={String(blocked)} sub={<RateText mom={rates.blocked_mom_pct} yoy={rates.blocked_yoy_pct} />} danger={blocked > 0} />
      <SummaryTile icon={<PackageCheck className="h-4 w-4" />} label="范围内待补资料" value={String(dataRequired)} sub="缺关键字段或业务资料" danger={dataRequired > 0} />
      <SummaryTile icon={<Store className="h-4 w-4" />} label="涉及店铺" value={String(storeRows.length)} sub="已定位平台店铺对象" danger={storeRows.some((item) => item.account_name === '待定位店铺')} />
    </div>
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
  if (mom == null && yoy == null) return <span>环比 -- · 同比 --</span>
  return <span>环比 {mom ?? '--'}% · 同比 {yoy ?? '--'}%</span>
}

export function UnassignedItemsPanel({
  assignError,
  assigning,
  canAssignToMe,
  onAssignFirstUnassignedToMe,
  onNavigate,
  unassignedItems,
  unassignedTotal,
}: {
  assignError: string
  assigning: boolean
  canAssignToMe: boolean
  onAssignFirstUnassignedToMe: () => void
  onNavigate: (route: string) => void
  unassignedItems: BusinessFlowItem[]
  unassignedTotal: number
}) {
  return (
    <section data-ui="flow-v5-unassigned-actions" aria-label="未分配对象处理" className="flow-command-card mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">未分配对象处理</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            当前有 {unassignedTotal} 个业务对象没有负责人；先把首批对象分配给当前用户，再进入处理总线逐项复盘。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canAssignToMe || assigning}
            onClick={onAssignFirstUnassignedToMe}
            className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:border-[var(--color-border)] disabled:text-[var(--color-muted)]"
          >
            {assigning ? '分配中...' : '一键分配给我'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/business-flow')}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            进入任务队列
          </button>
        </div>
      </div>
      {assignError ? <p className="mt-2 text-xs text-[var(--color-danger)]">{assignError}</p> : null}
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {unassignedItems.slice(0, 3).map((item) => (
          <button
            type="button"
            key={item.work_item_id || item.id}
            onClick={() => onNavigate(buildObjectRoute(item.next_action_route || item.route, item))}
            className="flow-object-panel rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition hover:border-[var(--color-primary)]"
          >
            <p className="truncate text-sm font-semibold text-[var(--color-fg)]" title={item.name}>{truncateObjectName(item.name)}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">{item.stage_name} · {item.lifecycle_label}</p>
            <p className="mt-2 line-clamp-1 text-[11px] text-[var(--color-warning)]">{item.gaps[0] || item.next_action}</p>
          </button>
        ))}
        {!unassignedItems.length ? (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
            当前没有未分配对象。
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function FlowComparisonChart({ comparisonRows }: { comparisonRows: any[] }) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-fg)]">商品流程数量对比</p>
        <span className="text-[11px] text-[var(--color-muted)]">图例显示天数，悬停看起止日期</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={comparisonRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.window || ''} />
          <Bar dataKey="items" name="流程商品数" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="blocked" name="阻塞商品数" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="dataRequired" name="待补资料商品数" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StageDwellComparisonPanel({
  onNavigate,
  stageDwellRows,
  stageDwellWindowLabel,
}: {
  onNavigate: (route: string) => void
  stageDwellRows: any[]
  stageDwellWindowLabel: string
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">阶段停留对比</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">按真实业务对象更新时间计算当前、环比、同比平均停留，定位哪个阶段正在拖慢上架链路。</p>
        </div>
        <Badge variant="outline">{stageDwellWindowLabel}</Badge>
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
  )
}

export function StageBottleneckMatrix({
  onNavigate,
  stageItems,
  stageRows,
}: {
  onNavigate: (route: string) => void
  stageItems: Map<string, BusinessFlowItem[]>
  stageRows: any[]
}) {
  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-fg)]">八阶段卡点矩阵</p>
        <span className="text-[11px] text-[var(--color-muted)]">信号收集 → 候选验证 → 选品决策 → Listing 制作 → 定价策略 → 平台刊登 → 订单履约 → 运营优化</span>
      </div>
      <div className="grid gap-2 xl:grid-cols-8">
        {stageRows.map((stage, index) => {
          const blocked = stage.blocked + stage.data_required
          const currentStageItems = stageItems.get(stage.key) || []
          const hiddenCount = Math.max(0, currentStageItems.length - 3)
          return (
            <article key={stage.key} data-ui="flow-v5-stage-matrix-card" className="flow-stage-card rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)]">
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
              <div className="mt-2 space-y-1">
                {currentStageItems.slice(0, 3).map((item) => (
                  <button
                    type="button"
                    key={item.work_item_id || item.id}
                    title={item.name}
                    onClick={() => onNavigate(buildObjectRoute(item.next_action_route || item.route, item))}
                    className="block w-full truncate rounded-md bg-[var(--color-bg)] px-2 py-1 text-left text-[11px] text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                  >
                    {item.assigned_to ? '' : '未分配 · '}{truncateObjectName(item.name)}
                  </button>
                ))}
              </div>
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate('/business-flow')}
                  className="mt-2 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  另有 {hiddenCount} 个对象 · 展开阶段对象
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

export function PlatformDistributionPanels({
  pieRows,
  platformRows,
}: {
  pieRows: any[]
  platformRows: any[]
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div data-ui="flow-v5-platform-distribution" className="flow-command-card rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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

      <div data-ui="flow-v5-platform-share" className="flow-command-card rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
  )
}

export function StoreHeatmapTable({
  onNavigate,
  storeRows,
}: {
  onNavigate: (route: string) => void
  storeRows: any[]
}) {
  return (
    <div data-ui="flow-v5-store-heatmap" className="flow-command-card mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
                    <p className="mt-0.5 text-[var(--color-muted)]">{store.platform} · {formatMarketLabel(store.market)}</p>
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
  )
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)]">{text}</div>
}

function formatComparisonRate(value: number | null) {
  if (value == null) return '环比 --'
  return value > 0 ? `环比 +${value}%` : `环比 ${value}%`
}

function formatMarketLabel(value?: string | null) {
  if (!value || value.toLowerCase() === 'unknown') return '--'
  return value
}

function truncateObjectName(name: string) {
  return name.length > 22 ? `${name.slice(0, 22)}…` : name
}
