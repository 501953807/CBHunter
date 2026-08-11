import { useState } from 'react'
import { Plus, Eye, TrendingUp, TrendingDown, Minus, Trash2, AlertCircle, Target, Star } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { useConfirm } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { useMonitorDashboard, useRemoveCompetitor } from '../hooks/useMonitor'
import { AddCompetitorModal, AlertRuleModal } from '../features/competitor/CompetitorModals'
import { labelBusinessCode } from '../utils/businessLabels'

export default function CompetitorMonitorPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAlertModal, setShowAlertModal] = useState<string | null>(null)
  const [listMode, setListMode] = useState<'all' | 'changed' | 'new'>('all')
  const competitorDashboardQuery = useMonitorDashboard()
  const d = competitorDashboardQuery.data?.data
  const competitors = (d?.competitors ?? []).filter((item) => (
    listMode === 'changed' ? item.prev_price != null && item.price !== item.prev_price
      : listMode === 'new' ? item.is_new_24h : true
  ))

  return (
    <div className="competitor-shell space-y-6 page-enter">
      <section className="competitor-hero">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--color-primary)]">COMPETITOR INTELLIGENCE</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-fg)]">竞品监控</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            以平台、卖家、价格、评分和快照变化为主线追踪竞品，辅助选品、定价和促销判断。
          </p>
        </div>
        <div className="competitor-hero-actions">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="competitor-primary-action"
          >
            <Plus className="w-4 h-4" /> 添加竞品
          </button>
        </div>
      </section>

      <div className="competitor-metric-grid">
        <button type="button" className="competitor-metric-card" data-active={listMode === 'all' ? 'true' : 'false'} onClick={() => setListMode('all')}>
          <span className="competitor-metric-icon"><Target className="w-4 h-4" /></span>
          <span className="text-xs text-[var(--color-muted)]">追踪竞品</span>
          <strong>{d?.total_tracked ?? 0}</strong>
        </button>
        <button type="button" className="competitor-metric-card" data-active={listMode === 'changed' ? 'true' : 'false'} onClick={() => setListMode('changed')}>
          <span className="competitor-metric-icon"><TrendingUp className="w-4 h-4" /></span>
          <span className="text-xs text-[var(--color-muted)]">24h价格变动</span>
          <strong>{d?.price_changes_24h ?? 0}</strong>
        </button>
        <button type="button" className="competitor-metric-card" data-active={listMode === 'new' ? 'true' : 'false'} onClick={() => setListMode('new')}>
          <span className="competitor-metric-icon"><Plus className="w-4 h-4" /></span>
          <span className="text-xs text-[var(--color-muted)]">24h新增</span>
          <strong>{d?.new_listings_24h ?? 0}</strong>
        </button>
        <div className="competitor-metric-card">
          <span className="competitor-metric-icon"><Minus className="w-4 h-4" /></span>
          <span className="text-xs text-[var(--color-muted)]">24h下架</span>
          <strong>{d?.delisted_24h ?? '--'}</strong>
        </div>
      </div>

      {Array.isArray(d?.data_gaps) && d.data_gaps.length > 0 && (
        <div className="competitor-gap-panel">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />
            <span className="text-sm font-medium text-[var(--color-fg)]">数据缺口</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.data_gaps.map((gap: string) => (
              <span key={gap} className="competitor-gap-chip">
                {labelBusinessCode(gap)}
              </span>
            ))}
          </div>
        </div>
      )}

      <CompetitorInsightPanel competitors={competitors} onOpenAlert={(id) => setShowAlertModal(id)} />

      <Card className="competitor-table-panel">
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[var(--color-fg)]">竞品追踪列表</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">展示当前筛选下的竞品、平台、卖家、价格变化和预警操作。</p>
            </div>
            <span className="competitor-count-pill">当前 {competitors.length} 条</span>
          </div>
          {competitorDashboardQuery.isError ? (
            <div
              data-ui="competitor-dashboard-error"
              className="competitor-error-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fg)]">竞品监控加载失败</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    无法读取竞品列表、价格追踪和预警上下文，请检查后端服务、登录状态或竞品采集数据源。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => competitorDashboardQuery.refetch()}
                  className="competitor-primary-action"
                >
                  重新加载竞品监控
                </button>
              </div>
            </div>
          ) : competitorDashboardQuery.isLoading ? (
            <div className="skeleton-shimmer h-64 rounded-xl" />
          ) : competitors.length === 0 ? (
            <EmptyState
              icon={<Eye className="w-10 h-10" />}
              title="暂无竞品"
              description={listMode === 'all' ? '点击「添加竞品」开始追踪竞争对手' : '当前筛选条件下暂无竞品'}
            />
          ) : (
            <div className="competitor-table-shell">
              <table className="professional-table w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>名称</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>平台</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>卖家</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>当前价格</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>价格变动</th>
                    <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>评分</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>评论数</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--color-muted)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c) => {
                    const priceDiff = c.prev_price != null && c.price != null ? c.price - c.prev_price : 0
                    return (
                      <tr key={c.id} className="competitor-row"
                        style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-fg)' }}>
                          <div>{c.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-normal text-[var(--color-muted)]">
                            <span>{c.market || '市场待补充'}</span><span>/</span><span>{c.collection_method === 'manual_url' ? '手工 URL' : c.collection_method || '采集方式待补充'}</span><span>/</span><span>{c.confidence_level === 'merchant_input' ? '待复核' : c.confidence_level || '可信度待补充'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="competitor-platform-chip">
                            {c.platform?.toUpperCase?.() || c.platform}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                          {c.seller_name || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-fg)' }}>
                          {c.price != null ? `${c.currency || ''} ${c.price.toFixed(2)}`.trim() : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.prev_price != null && priceDiff !== 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              {priceDiff > 0 ? (
                                <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
                              )}
                              <span className="text-xs font-mono" style={{
                                color: priceDiff > 0 ? 'var(--color-danger)' : 'var(--color-success)'
                              }}>
                                {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <Minus className="w-3.5 h-3.5 mx-auto" style={{ color: 'var(--color-muted)' }} />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.rating != null ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: c.rating >= 4.5 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                              <Star className="h-3.5 w-3.5" fill="currentColor" /> {c.rating.toFixed(1)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs" style={{ color: 'var(--color-muted)' }}>
                          {c.review_count ?? '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <CompetitorActions
                            competitorId={c.id}
                            onSetAlert={() => setShowAlertModal(c.id)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddModal && <AddCompetitorModal onClose={() => setShowAddModal(false)} />}
      {showAlertModal && (
        <AlertRuleModal competitorId={showAlertModal} onClose={() => setShowAlertModal(null)} />
      )}
    </div>
  )
}

function CompetitorInsightPanel({ competitors, onOpenAlert }: { competitors: any[]; onOpenAlert: (id: string) => void }) {
  const changed = competitors.filter(item => item.prev_price != null && item.price != null && item.price !== item.prev_price)
  const maxAbs = Math.max(...changed.map(item => Math.abs(Number(item.price || 0) - Number(item.prev_price || 0))), 1)
  const first = competitors[0]
  return (
    <Card className="competitor-panel">
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">竞品详细监控视图</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">竞品列表、价格追踪、快照对比和预警设置都基于当前已追踪竞品；无快照时显示缺口，不补造价格历史。</p>
          </div>
          {first && (
            <button onClick={() => onOpenAlert(first.id)} className="competitor-secondary-action">
              预警设置
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4" data-ui="competitor-price-trend">
          <CompetitorInsightCard title="竞品列表" value={competitors.length} detail="当前筛选下可追踪的竞品对象数量。" />
          <CompetitorInsightCard title="价格追踪" value={changed.length} detail="存在上一价格且发生变化的竞品数量。" />
          <CompetitorInsightCard title="快照对比" value={competitors.filter(item => item.prev_price != null).length} detail="已有前后价格快照可对比的竞品。" />
          <div className="competitor-trend-panel">
            <p className="text-sm font-semibold text-[var(--color-fg)]">价格变化趋势</p>
            <div className="mt-3 space-y-2">
              {changed.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">暂无真实价格变化快照。</p>
              ) : changed.slice(0, 4).map(item => {
                const diff = Number(item.price || 0) - Number(item.prev_price || 0)
                return (
                  <div key={item.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-[var(--color-muted)]">{item.name}</span>
                      <span className={diff > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}</span>
                    </div>
                    <div className="competitor-trend-bar">
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(Math.abs(diff) / maxAbs * 100, 4)}%`, background: diff > 0 ? 'var(--color-danger)' : 'var(--color-success)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompetitorInsightCard({ title, value, detail }: { title: string; value: number; detail: string }) {
  return (
    <div className="competitor-insight-card">
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  )
}

/* ── Actions button group ── */
function CompetitorActions({ competitorId, onSetAlert }: { competitorId: string; onSetAlert: () => void }) {
  const remove = useRemoveCompetitor()
  const confirmAction = useConfirm()

  const handleRemove = async () => {
    const ok = await confirmAction({
      title: '取消竞品追踪',
      message: '确定取消追踪该竞品？取消后不会继续记录价格、销量和排名变化。',
      confirmText: '取消追踪',
      tone: 'danger',
    })
    if (ok) remove.mutate(competitorId)
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button aria-label="设置预警" onClick={onSetAlert} className="competitor-action-button"
        style={{ color: 'var(--color-warning)' }} title="设置预警">
        <AlertCircle className="w-3.5 h-3.5" />
      </button>
      <button aria-label="取消追踪" onClick={() => void handleRemove()}
        className="competitor-action-button"
        style={{ color: 'var(--color-danger)' }} title="取消追踪">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
