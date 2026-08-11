import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, Lightbulb, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { getBlueOceanOpportunities, type BlueOceanResponse } from '../api/dashboard'
import { createProductOperationAction, getProductOperationMetrics, type ProductOperationMetrics } from '../api/operations'
import { logger } from '../utils/logger'
import { useNavigate } from 'react-router-dom'
import { labelBusinessCode, uniqueBusinessActions } from '../utils/businessLabels'

export default function GrowthEnginePage() {
  const navigate = useNavigate()
  const [creatingAction, setCreatingAction] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const growthOpportunityQuery = useQuery({
    queryKey: ['growth-opportunities'],
    queryFn: () => getBlueOceanOpportunities({ limit: 9 }),
  })
  const growthMetricsQuery = useQuery({
    queryKey: ['growth-product-metrics'],
    queryFn: getProductOperationMetrics,
  })
  const summary = growthOpportunityQuery.data?.data || null
  const productMetrics = growthMetricsQuery.data?.data || null

  const opportunities = summary?.opportunities || []
  const dataGaps = summary?.data_gaps || []
  const nextActions = uniqueBusinessActions(dataGaps, { label: '查看运营台账复盘增长动作', route: '/operations' })

  const createOperationAction = async (listingId: string, diagnosticCode: string) => {
    const key = `${listingId}:${diagnosticCode}`
    setCreatingAction(key)
    setActionMessage('')
    try {
      const response = await createProductOperationAction({ listing_id: listingId, diagnostic_code: diagnosticCode })
      setActionMessage(response.data?.name ? `已生成运营台账：${response.data.name}` : '已生成运营台账动作')
    } catch (e: any) {
      logger.error('Create product operation action failed', e)
      setActionMessage(e?.response?.data?.detail || '生成运营台账动作失败')
    } finally {
      setCreatingAction('')
    }
  }

  return (
    <div className="growth-shell space-y-6">
      <div className="growth-hero px-5 py-5">
        <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="luxury-section-kicker">Growth operations</p>
            <h1 className="luxury-page-title mt-2 text-3xl font-bold">增长引擎</h1>
            <p className="luxury-page-description mt-2">
              基于真实趋势、利润、竞争和供应链信号生成增长机会
            </p>
          </div>
          <div className="luxury-page-actions text-xs text-[var(--color-muted)]">
            <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5">机会发现</span>
            <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5">实验复盘</span>
            <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-1.5">台账闭环</span>
          </div>
        </div>
      </div>

      <Card className="growth-summary-panel">
        <CardContent className="pt-4">
          {growthOpportunityQuery.isError && (
            <div
              data-ui="growth-opportunity-error"
              className="growth-error-panel mb-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">增长机会加载失败，当前趋势、利润、竞争和供应链信号暂不可用。</span>
              <button
                type="button"
                onClick={() => growthOpportunityQuery.refetch()}
                className="luxury-control rounded-[var(--radius-lg)] px-3 py-1.5 text-[var(--color-danger)]"
              >
                重新加载增长机会
              </button>
            </div>
          )}
          <div className="growth-summary-grid text-sm">
            <div className="growth-mini-tile p-3">
              <p className="text-xs text-[var(--color-muted)]">数据范围</p>
              <p className="mt-1 text-[var(--color-fg)]">{summary?.evidence_window || '等待趋势、竞品、利润和供应链数据'}</p>
            </div>
            <div className="growth-mini-tile p-3">
              <p className="text-xs text-[var(--color-muted)]">来源数量</p>
              <p className="mt-1 text-[var(--color-fg)]">{summary?.source_refs?.length || 0}</p>
            </div>
            <div className="growth-mini-tile p-3">
              <p className="text-xs text-[var(--color-muted)]">置信说明</p>
              <p className="mt-1 text-[var(--color-fg)]">{summary?.confidence_reason || '数据不足时不生成确定性增长建议'}</p>
            </div>
          </div>
          {dataGaps.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {dataGaps.map(gap => (
                <span key={gap} className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                  {labelBusinessCode(gap)}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GrowthExperimentPanel opportunities={opportunities} productMetrics={productMetrics} />

      <Card className="growth-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">增长洞察</h2>
          </div>
        </CardHeader>
        <CardContent>
          {growthOpportunityQuery.isLoading ? (
            <div className="skeleton-shimmer h-28 rounded-xl" />
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="w-10 h-10" />}
              title="暂无可验证增长洞察"
              description="需要先采集趋势词、竞品数据，并录入选品成本/利润后再生成增长建议"
            />
          ) : (
            <div className="growth-opportunity-grid">
              {opportunities.map((item) => (
                <div key={item.keyword_id} className="growth-opportunity-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-[var(--color-fg)]">{item.keyword}</p>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        {item.market || '未标市场'} · {item.category || '未标品类'}
                      </p>
                    </div>
                    <Badge variant={item.evidence_completeness_pct === 100 && item.blue_ocean_score >= 75 ? 'success' : 'default'}>
                      {item.blue_ocean_score}分
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-2 line-clamp-2">
                    {item.recommendation || '等待更多经营数据校准建议'}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-1">资料完整度 {item.evidence_completeness_pct}%</p>
                  <div className="growth-score-strip mt-2" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, item.evidence_completeness_pct || 0))}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-3">
                    {[
                      ['趋势', item.dimensions?.trend_strength],
                      ['利润', item.dimensions?.profit_potential],
                      ['竞争', item.dimensions?.competition_gap],
                      ['供应', item.dimensions?.supply_chain],
                    ].map(([label, value]) => (
                      <div key={label as string} className="growth-mini-tile px-1.5 py-1 text-center">
                        <p className="text-[11px] text-[var(--color-muted)]">{label as string}</p>
                        <p className="text-xs font-semibold text-[var(--color-fg)]">{value == null ? '--' : value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="growth-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">商品运营诊断</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按 Listing 已同步或导入的最近30天指标生成诊断，不把缺失平台 Open API 指标当作 0。</p>
        </CardHeader>
        <CardContent>
          {growthMetricsQuery.isError && (
            <div
              data-ui="growth-metrics-error"
              className="growth-error-panel mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <span className="text-[var(--color-danger)]">商品运营指标加载失败，当前 Listing 表现、诊断机会和待复盘动作暂不可用。</span>
              <button
                type="button"
                onClick={() => growthMetricsQuery.refetch()}
                className="luxury-control rounded-[var(--radius-lg)] px-3 py-1.5 text-[var(--color-danger)]"
              >
                重新加载运营指标
              </button>
            </div>
          )}
          {growthMetricsQuery.isLoading ? (
            <div className="skeleton-shimmer h-28 rounded-xl" />
          ) : !productMetrics?.items?.length ? (
            <EmptyState
              icon={<BarChart3 className="w-10 h-10" />}
              title="暂无商品运营指标"
              description="需要先接入平台经营指标，或从卖家后台导入 Listing performance 数据。"
            />
          ) : (
            <div className="space-y-3">
              {actionMessage && (
                <p className="growth-mini-tile px-3 py-2 text-xs text-[var(--color-fg)]">
                  {actionMessage}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Listing" value={productMetrics.summary.listing_count} />
                <MetricBox label="诊断机会" value={productMetrics.summary.diagnostic_count} />
                <MetricBox label="待复盘动作" value={productMetrics.summary.pending_action_count ?? 0} />
              </div>
              {(productMetrics.summary.reviewed_action_count ?? 0) > 0 && (
                <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  已有 {productMetrics.summary.reviewed_action_count} 条运营台账复盘结果反哺到商品诊断。后续同类 Listing 优化应优先参考这些复盘结论。
                </p>
              )}
              <div className="growth-diagnostic-grid">
                {productMetrics.items.slice(0, 6).map((item) => (
                  <div key={item.listing_id} className="growth-diagnostic-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{item.product_name}</p>
                        <p className="mt-1 truncate text-[11px] text-[var(--color-muted)]">{[item.platform, item.account_name, item.market].filter(Boolean).join(' · ') || '平台店铺待补'}</p>
                      </div>
                      <Badge variant={item.diagnostics.some(diag => diag.level === 'critical') ? 'danger' : item.diagnostics.some(diag => diag.level === 'warning') ? 'warning' : 'info'}>
                        {item.diagnostics[0]?.title || '观察'}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                      <MetricMini label="曝光" value={item.metrics.impressions_30d} />
                      <MetricMini label="浏览" value={item.metrics.views_30d} />
                      <MetricMini label="订单" value={item.metrics.orders_30d} />
                      <MetricMini label="转化" value={item.metrics.conversion_rate_pct == null ? null : `${item.metrics.conversion_rate_pct}%`} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs text-[var(--color-muted)]">{item.diagnostics[0]?.detail || '等待下一轮指标变化。'}</p>
                    <OperationFeedbackSummary feedback={item.operation_feedback} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.diagnostics[0] && (
                        <button
                          onClick={() => createOperationAction(item.listing_id, item.diagnostics[0].code)}
                          disabled={creatingAction === `${item.listing_id}:${item.diagnostics[0].code}`}
                          className="luxury-control rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-[11px] text-[var(--color-primary-text)] disabled:opacity-60"
                        >
                          {creatingAction === `${item.listing_id}:${item.diagnostics[0].code}` ? '生成中...' : '生成运营台账'}
                        </button>
                      )}
                      {item.growth_actions.slice(0, 2).map(action => (
                        <button key={`${item.listing_id}-${action.route}`} onClick={() => navigate(action.route)} className="luxury-control rounded-full px-2.5 py-1 text-[11px] text-[var(--color-primary)]">
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="growth-panel">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">下一步动作</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="growth-action-grid">
            {nextActions.map(action => (
              <button key={action.route} onClick={() => navigate(action.route)} className="growth-action-card flex items-center gap-2 px-3 py-2 text-left">
                <ArrowRight className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                <span className="text-xs text-[var(--color-fg)]">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="growth-mini-tile p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function GrowthExperimentPanel({ opportunities, productMetrics }: { opportunities: BlueOceanResponse['opportunities']; productMetrics: ProductOperationMetrics | null }) {
  const experimentCandidates = opportunities.slice(0, 3)
  const reviewed = productMetrics?.summary.reviewed_action_count ?? 0
  const pending = productMetrics?.summary.pending_action_count ?? 0
  return (
    <Card className="growth-panel">
      <CardHeader>
        <h2 className="font-semibold text-[var(--color-fg)]">增长实验工作台</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">把机会发现、实验管理、反馈学习和 A/B测试 放在一个闭环里；缺真实机会时不生成固定策略模板。</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4" data-ui="growth-ab-test-panel">
          <GrowthExperimentCard title="机会发现" value={opportunities.length} detail="来自趋势、利润、竞争和供应链资料完整度。" />
          <GrowthExperimentCard title="实验管理" value={experimentCandidates.length} detail="优先选择高分机会进入标题、主图、价格或投放实验。" />
          <GrowthExperimentCard title="反馈学习" value={reviewed} detail={`待复盘动作 ${pending} 个；复盘结果会反哺商品运营诊断。`} />
          <div className="growth-experiment-card p-3">
            <p className="text-sm font-semibold text-[var(--color-fg)]">A/B测试</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <span className="growth-mini-tile px-2 py-1 text-[var(--color-muted)]">A 方案：当前 Listing</span>
              <span className="growth-mini-tile px-2 py-1 text-[var(--color-muted)]">B 方案：待生成候选</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--color-muted)]">实验发布前必须绑定商品、平台店铺、指标窗口和预算，不在本页假定实验成功。</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function GrowthExperimentCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="growth-experiment-card p-3">
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

function MetricMini({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="growth-mini-tile px-1.5 py-1">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="text-xs font-semibold text-[var(--color-fg)]">{value == null ? '--' : value}</p>
    </div>
  )
}

function OperationFeedbackSummary({ feedback }: { feedback: ProductOperationMetrics['items'][number]['operation_feedback'] }) {
  if (!feedback?.record_id) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] px-2.5 py-2">
        <p className="text-[11px] font-medium text-[var(--color-muted)]">运营闭环</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">尚未生成运营台账动作。</p>
      </div>
    )
  }
  return (
    <div className="growth-feedback-card mt-3 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-[var(--color-fg)]">{feedback.has_review ? '运营复盘反哺' : '运营动作待复盘'}</p>
        <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
          已复盘 {feedback.reviewed_count} · 待处理 {feedback.pending_count}
        </span>
      </div>
      <p className="mt-1 line-clamp-1 text-[11px] text-[var(--color-muted)]">{feedback.record_name}</p>
      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-fg)]">
        {feedback.review_result || '动作已进入台账，完成后需要填写复盘结果，系统再反哺商品诊断。'}
      </p>
      {feedback.effect_summary && (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-muted)]">{feedback.effect_summary}</p>
      )}
    </div>
  )
}
