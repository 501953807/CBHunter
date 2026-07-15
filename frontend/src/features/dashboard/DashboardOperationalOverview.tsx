import { Brain, Globe, Image, MessageCircle, Package, Search, ShoppingCart } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import type { BlueOceanOpportunity } from '../../api/dashboard'
import type { DictMarket } from '../../api/config'
import type { DashboardSummary } from '../../types/sourcing'

interface DashboardOperationalOverviewProps {
  summary: DashboardSummary | null
  opportunities: BlueOceanOpportunity[]
  markets: DictMarket[]
  loading: boolean
  onLoadOpportunities: (market?: string) => void
}

const DIMENSION_KEYS = ['trend_strength', 'profit_potential', 'competition_gap', 'supply_chain'] as const
const DIMENSION_COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-info)']

export function DashboardOperationalOverview({
  summary,
  opportunities,
  markets,
  loading,
  onLoadOpportunities,
}: DashboardOperationalOverviewProps) {
  return (
    <>
      <Card style={{ borderColor: 'var(--color-accent)', borderWidth: 2 }}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5 text-[15px]">
              <Brain className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
              蓝海雷达
            </h2>
            <div className="flex items-center gap-1">
              {markets.map((market) => (
                <button key={market.id} onClick={() => onLoadOpportunities(market.id)}
                  className="text-[11px] px-1.5 py-0.5 rounded hover:bg-[var(--color-accent-light)]">{market.id}</button>
              ))}
              <button onClick={() => onLoadOpportunities()} className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-accent-light)] text-[var(--color-accent)]">全部</button>
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-[var(--color-muted)] py-4 text-center">计算中...</div>
          ) : opportunities.length === 0 ? (
            <div className="text-xs text-[var(--color-muted)] py-4 text-center">
              暂无趋势数据，请在品源管理中同步 Google Trends / Pinterest 数据后查看
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {opportunities.map((opportunity) => (
                <div key={opportunity.keyword_id} className="rounded-lg p-2.5 border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate">{opportunity.keyword}</p>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      opportunity.evidence_completeness_pct === 100 && opportunity.blue_ocean_score >= 75 ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]' :
                      opportunity.blue_ocean_score >= 55 ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' :
                      'bg-[var(--color-bg)] text-[var(--color-muted)]'}`}>
                      {opportunity.blue_ocean_score}分
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-[var(--color-muted)]">{opportunity.market}</span>
                    <span className="text-[var(--color-muted)]">·</span>
                    <span className="text-[var(--color-accent)]">{opportunity.opportunity_level}</span>
                    <span className="text-[var(--color-muted)]">·</span>
                    <span className="text-[var(--color-muted)]">资料 {opportunity.evidence_completeness_pct}%</span>
                    <span className="text-[var(--color-muted)]">·</span>
                    <span className="text-[var(--color-success)]">
                      {opportunity.dimensions?.profit_detail?.avg_margin_pct == null
                        ? '利润缺数据'
                        : `历史利润率 ${opportunity.dimensions.profit_detail.avg_margin_pct}%`}
                    </span>
                  </div>
                  <div className="flex gap-0.5 mt-1.5">
                    {DIMENSION_KEYS.map((dimension, index) => (
                      <div key={dimension} className="flex-1 h-1 rounded-full" style={{
                        background: DIMENSION_COLORS[index],
                        opacity: (opportunity.dimensions?.[dimension] || 0) / 100,
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5 text-[15px] mb-4">
              <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              四层信号概览
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '趋势层', value: summary.layer_counts.trend, icon: <Search className="w-4 h-4" />, color: 'var(--color-primary)' },
                { label: '平台层', value: summary.layer_counts.platform, icon: <ShoppingCart className="w-4 h-4" />, color: 'var(--color-warning)' },
                { label: '供应链层', value: summary.layer_counts.supply, icon: <Image className="w-4 h-4" />, color: 'var(--color-info)' },
                { label: '文化层', value: summary.layer_counts.culture, icon: <MessageCircle className="w-4 h-4" />, color: 'var(--color-accent)' },
              ].map((layer) => (
                <div key={layer.label} className="rounded-xl p-3 border text-center"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <div className="flex items-center justify-center gap-1 mb-1" style={{ color: layer.color }}>
                    {layer.icon}
                    <span className="text-xs font-medium">{layer.label}</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: layer.color }}>{layer.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-[var(--color-fg)] flex items-center gap-1.5 text-[15px] mb-4">
              <Package className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              选品流水线
              <span className="text-xs font-normal" style={{ color: 'var(--color-muted)' }}>共 {summary.pipeline.total} 个选品</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { key: 'discovery', label: '选品中', value: summary.pipeline.discovery, color: 'var(--color-primary)' },
                { key: 'jit_testing', label: 'JIT测试', value: summary.pipeline.jit_testing, color: 'var(--color-accent)' },
                { key: 'jit_passed', label: 'JIT通过', value: summary.pipeline.jit_passed, color: 'var(--color-info)' },
                { key: 'price_review', label: '价格审核', value: summary.pipeline.price_review, color: 'var(--color-warning)' },
                { key: 'vmi', label: 'VMI备货', value: summary.pipeline.vmi, color: 'var(--color-warning)' },
                { key: 'active', label: '在售', value: summary.pipeline.active, color: 'var(--color-success)' },
                { key: 'discontinued', label: '停售', value: summary.pipeline.discontinued, color: 'var(--color-danger)' },
              ].map((stage) => (
                <div key={stage.key} className="rounded-lg p-2.5 text-center border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>{stage.label}</p>
                  <p className="text-xl font-bold" style={{ color: stage.color }}>{stage.value}</p>
                </div>
              ))}
            </div>
            {summary.pending.pending_analysis > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--color-warning)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />
                待分析图片 {summary.pending.pending_analysis} 张 · 待决策 {summary.pending.pending_decision} 项
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
