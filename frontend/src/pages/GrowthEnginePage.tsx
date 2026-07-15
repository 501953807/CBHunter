import { useEffect, useState } from 'react'
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
  const [summary, setSummary] = useState<BlueOceanResponse | null>(null)
  const [productMetrics, setProductMetrics] = useState<ProductOperationMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingAction, setCreatingAction] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    Promise.all([
      getBlueOceanOpportunities({ limit: 9 }),
      getProductOperationMetrics(),
    ])
      .then(([opportunityResponse, productMetricResponse]) => {
        setSummary(opportunityResponse.data || null)
        setProductMetrics(productMetricResponse.data || null)
      })
      .catch(e => logger.error('Load growth opportunities and product metrics failed', e))
      .finally(() => setLoading(false))
  }, [])

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">增长引擎</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          基于真实趋势、利润、竞争和供应链信号生成增长机会
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-muted)]">数据范围</p>
              <p className="mt-1 text-[var(--color-fg)]">{summary?.evidence_window || '等待趋势、竞品、利润和供应链数据'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted)]">来源数量</p>
              <p className="mt-1 text-[var(--color-fg)]">{summary?.source_refs?.length || 0}</p>
            </div>
            <div>
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">增长洞察</h2>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="skeleton-shimmer h-28 rounded-xl" />
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="w-10 h-10" />}
              title="暂无可验证增长洞察"
              description="需要先采集趋势词、竞品数据，并录入选品成本/利润后再生成增长建议"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {opportunities.map((item) => (
                <div key={item.keyword_id} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
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
                  <div className="grid grid-cols-4 gap-1 mt-3">
                    {[
                      ['趋势', item.dimensions?.trend_strength],
                      ['利润', item.dimensions?.profit_potential],
                      ['竞争', item.dimensions?.competition_gap],
                      ['供应', item.dimensions?.supply_chain],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded bg-[var(--color-bg)] px-1.5 py-1 text-center">
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">商品运营诊断</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">按 Listing 已同步或导入的最近30天指标生成诊断，不把缺失平台 Open API 指标当作 0。</p>
        </CardHeader>
        <CardContent>
          {loading ? (
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
                <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)]">
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
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {productMetrics.items.slice(0, 6).map((item) => (
                  <div key={item.listing_id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
                          className="rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-[11px] text-[var(--color-primary-text)] transition disabled:opacity-60"
                        >
                          {creatingAction === `${item.listing_id}:${item.diagnostics[0].code}` ? '生成中...' : '生成运营台账'}
                        </button>
                      )}
                      {item.growth_actions.slice(0, 2).map(action => (
                        <button key={`${item.listing_id}-${action.route}`} onClick={() => navigate(action.route)} className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-primary)] transition hover:border-[var(--color-primary)]">
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="font-semibold text-[var(--color-fg)]">下一步动作</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextActions.map(action => (
              <button key={action.route} onClick={() => navigate(action.route)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]" style={{ borderColor: 'var(--color-border)' }}>
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  )
}

function MetricMini({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] px-1.5 py-1">
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
    <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
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
