import { useState } from 'react'
import { Plus, Eye, TrendingUp, TrendingDown, Minus, Trash2, AlertCircle, Target, Star } from 'lucide-react'
import { PageHeader } from '../components/shared/PageHeader'
import { StatCard } from '../components/shared/StatCard'
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
    <div className="space-y-6 page-enter">
      <PageHeader
        title="竞品监控"
        description="追踪竞品价格、销量、排名变化，及时预警"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-primary-text)] transition-colors hover:opacity-90"
            style={{ background: 'var(--gradient-accent)' }}
          >
            <Plus className="w-4 h-4" /> 添加竞品
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="追踪竞品" value={d?.total_tracked ?? 0} icon={<Target className="w-4 h-4" />} onClick={() => setListMode('all')} active={listMode === 'all'} />
        <StatCard label="24h价格变动" value={d?.price_changes_24h ?? 0} icon={<TrendingUp className="w-4 h-4" />} onClick={() => setListMode('changed')} active={listMode === 'changed'} />
        <StatCard label="24h新增" value={d?.new_listings_24h ?? 0} icon={<Plus className="w-4 h-4" />} onClick={() => setListMode('new')} active={listMode === 'new'} />
        <StatCard label="24h下架" value={d?.delisted_24h ?? '--'} icon={<Minus className="w-4 h-4" />} />
      </div>

      {Array.isArray(d?.data_gaps) && d.data_gaps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
          {d.data_gaps.map((gap: string) => (
            <span key={gap} className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
              {labelBusinessCode(gap)}
            </span>
          ))}
        </div>
      )}

      <CompetitorInsightPanel competitors={competitors} onOpenAlert={(id) => setShowAlertModal(id)} />

      {/* Competitor Table */}
      <Card>
        <CardContent>
          {competitorDashboardQuery.isError ? (
            <div
              data-ui="competitor-dashboard-error"
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)' }}
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
                  className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)' }}
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
            <div className="overflow-x-auto">
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
                      <tr key={c.id} className="transition-colors hover:bg-[var(--color-bg)]"
                        style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-fg)' }}>
                          <div>{c.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-normal text-[var(--color-muted)]">
                            <span>{c.market || '市场待补充'}</span><span>·</span><span>{c.collection_method === 'manual_url' ? '手工 URL' : c.collection_method || '采集方式待补充'}</span><span>·</span><span>{c.confidence_level === 'merchant_input' ? '待复核' : c.confidence_level || '可信度待补充'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-text)' }}>
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
    <Card>
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">竞品详细监控视图</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">竞品列表、价格追踪、快照对比和预警设置都基于当前已追踪竞品；无快照时显示缺口，不补造价格历史。</p>
          </div>
          {first && (
            <button onClick={() => onOpenAlert(first.id)} className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-primary)] hover:border-[var(--color-primary)]">
              预警设置
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4" data-ui="competitor-price-trend">
          <CompetitorInsightCard title="竞品列表" value={competitors.length} detail="当前筛选下可追踪的竞品对象数量。" />
          <CompetitorInsightCard title="价格追踪" value={changed.length} detail="存在上一价格且发生变化的竞品数量。" />
          <CompetitorInsightCard title="快照对比" value={competitors.filter(item => item.prev_price != null).length} detail="已有前后价格快照可对比的竞品。" />
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
                    <div className="h-1.5 rounded-full bg-[var(--color-border)]">
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
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
      <button aria-label="设置预警" onClick={onSetAlert} className="p-1.5 rounded transition-colors hover:bg-[var(--color-border)]"
        style={{ color: 'var(--color-warning)' }} title="设置预警">
        <AlertCircle className="w-3.5 h-3.5" />
      </button>
      <button aria-label="取消追踪" onClick={() => void handleRemove()}
        className="p-1.5 rounded transition-colors hover:bg-[var(--color-border)]"
        style={{ color: 'var(--color-danger)' }} title="取消追踪">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
