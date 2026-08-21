import { useMemo, useState } from 'react'
import { updateBusinessFlowTasks } from '../../api/businessFlow'
import { Badge } from '../../components/ui/Badge'
import { CommandInsightStrip } from '../../components/shared/CommandInsightStrip'
import { ComparisonRangeCards } from '../../components/shared/ComparisonRangeCards'
import type { BusinessFlowItem, BusinessFlowOverview } from '../../types/businessFlow'
import { comparisonRangeLabel } from '../../utils/comparisonRange'
import { logger } from '../../utils/logger'
import { buildObjectRoute } from './businessFlowRoutes'
import {
  FlowComparisonChart,
  FlowHeroAction,
  FlowHeroMetric,
  FlowSummaryTiles,
  PlatformDistributionPanels,
  StageBottleneckMatrix,
  StageDwellComparisonPanel,
  StoreHeatmapTable,
  UnassignedItemsPanel,
} from './BusinessFlowCommandBoardParts'

interface Props {
  data: BusinessFlowOverview
  onNavigate: (route: string) => void
  onReload?: () => Promise<void>
}

export function BusinessFlowCommandBoard({ data, onNavigate, onReload }: Props) {
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')
  const stageRows = data.flow_stage_matrix
  const platformRows = data.flow_platform_matrix
  const storeRows = data.flow_store_matrix.slice(0, 8)
  const unassignedItems = useMemo(
    () => data.items.filter((item) => !item.assigned_to).slice(0, 6),
    [data.items],
  )
  const unassignedTotal = data.items.filter((item) => !item.assigned_to).length
  const stageItems = useMemo(() => {
    const groups = new Map<string, BusinessFlowItem[]>()
    data.items.forEach((item) => {
      const current = groups.get(item.stage_key) || []
      current.push(item)
      groups.set(item.stage_key, current)
    })
    return groups
  }, [data.items])
  const pieRows = platformRows.map((item) => ({ name: item.platform, value: item.object_count }))
  const comparisonRows = [
    { period: comparisonRangeLabel('current', data.comparison.windows.current), window: data.comparison.windows.current, items: data.comparison.current.items, blocked: data.comparison.current.blocked, dataRequired: data.comparison.current.data_required },
    { period: comparisonRangeLabel('previous', data.comparison.windows.previous), window: data.comparison.windows.previous, items: data.comparison.previous?.items ?? 0, blocked: data.comparison.previous?.blocked ?? 0, dataRequired: data.comparison.previous?.data_required ?? 0 },
    { period: comparisonRangeLabel('lastYear', data.comparison.windows.last_year), window: data.comparison.windows.last_year, items: data.comparison.last_year?.items ?? 0, blocked: data.comparison.last_year?.blocked ?? 0, dataRequired: data.comparison.last_year?.data_required ?? 0 },
  ]
  const stageDwellRows = [...data.comparison.stage_dwell].sort((a, b) => (b.current.avg_wait_hours ?? -1) - (a.current.avg_wait_hours ?? -1))
  const stageDwellWindowLabel = [
    comparisonRangeLabel('current', data.comparison.windows.current),
    comparisonRangeLabel('previous', data.comparison.windows.previous),
    comparisonRangeLabel('lastYear', data.comparison.windows.last_year),
  ].join(' / ')
  const currentWindow = data.comparison.windows.current || '业务日期范围待补'
  const bottleneckStage = [...stageRows].sort((a, b) => ((b.blocked + b.data_required) - (a.blocked + a.data_required)))[0]
  const primaryAction = data.next_actions.find((action) => action.primary) || data.next_actions[0]
  const blockedRate = data.comparison.current.items
    ? Number((((data.comparison.current.blocked + data.comparison.current.data_required) / data.comparison.current.items) * 100).toFixed(1))
    : null
  const topBlockedStore = [...data.flow_store_matrix].sort((a, b) => ((b.blocked + b.data_required) - (a.blocked + a.data_required)))[0]
  const flowPriority = blockedRate == null ? '待形成' : blockedRate > 30 ? '立即疏通' : blockedRate > 10 ? '今日处理' : '正常推进'
  const primaryActionRoute = primaryAction ? buildObjectRoute(primaryAction.route, primaryAction) : '/business-flow'
  const canAssignToMe = Boolean(data.current_username && unassignedItems.length)

  const assignFirstUnassignedToMe = async () => {
    if (!data.current_username || unassignedItems.length === 0) {
      onNavigate('/business-flow')
      return
    }
    setAssigning(true)
    setAssignError('')
    try {
      await updateBusinessFlowTasks({
        action: 'assign',
        assigned_to: data.current_username,
        items: unassignedItems.map(toTaskRef),
      })
      await onReload?.()
    } catch (e: any) {
      logger.error('业务监控台首屏一键分配失败', e)
      setAssignError(e?.response?.data?.detail || e?.message || '一键分配失败')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <section aria-label="业务流程总分看板" data-ui="flow-v5-command-board" className="flow-command-board rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-md)]">
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
        className="flow-command-card mb-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)]"
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

          <aside aria-label="业务处理动作" data-ui="flow-v5-action-panel" className="flow-command-card rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
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
        ariaLabel="商品流程对比范围说明"
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

      <FlowSummaryTiles
        blocked={data.comparison.current.blocked}
        dataRequired={data.comparison.current.data_required}
        itemCount={data.comparison.current.items}
        rates={data.comparison.rates}
        storeRows={data.flow_store_matrix}
      />
      <UnassignedItemsPanel
        assignError={assignError}
        assigning={assigning}
        canAssignToMe={canAssignToMe}
        onAssignFirstUnassignedToMe={assignFirstUnassignedToMe}
        onNavigate={onNavigate}
        unassignedItems={unassignedItems}
        unassignedTotal={unassignedTotal}
      />
      <FlowComparisonChart comparisonRows={comparisonRows} />
      <StageDwellComparisonPanel
        onNavigate={onNavigate}
        stageDwellRows={stageDwellRows}
        stageDwellWindowLabel={stageDwellWindowLabel}
      />
      <StageBottleneckMatrix onNavigate={onNavigate} stageItems={stageItems} stageRows={stageRows} />
      <PlatformDistributionPanels pieRows={pieRows} platformRows={platformRows} />
      <StoreHeatmapTable onNavigate={onNavigate} storeRows={storeRows} />
    </section>
  )
}

function toTaskRef(item: BusinessFlowItem) {
  return {
    item_type: item.type,
    item_id: item.id,
    stage_key: item.stage_key,
    title: item.name,
    route: item.route,
    source_refs: item.source_refs,
    last_gap: item.gaps[0] || null,
  }
}
