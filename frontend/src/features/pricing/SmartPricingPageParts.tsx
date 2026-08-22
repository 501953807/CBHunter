import { Calculator, Shield, Target, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatCard } from '../../components/shared/StatCard'
import { PricingTemplateStorePreview } from './PricingTemplateStorePreview'
import { PricingFeeTemplatePanel } from './PricingFeeTemplatePanel'
import { PricingDecisionContext } from './PricingDecisionContext'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../../api/pricing'
import type { FeeRateItem, PricingAdjustmentTemplateItem } from '../../api/settings'
import { businessActionForCode, labelBusinessCode } from '../../utils/businessLabels'
export { PricingInputPanel } from './SmartPricingInputPanelParts'

export function PricingCommandStrip({
  pricingItemsCount,
  selectedStoreLabel,
  pricingTemplateLabel,
  readinessLabel,
  ready,
}: {
  pricingItemsCount: number
  selectedStoreLabel: string
  pricingTemplateLabel: string
  readinessLabel: string
  ready: boolean
}) {
  return (
    <section className="pricing-command-strip" aria-label="定价模板工作台概览">
      <div>
        <span className="pricing-command-kicker">PRICING TEMPLATE</span>
        <h2>店铺 Listing 定价模板工作台</h2>
        <p>先选内容工厂确认的商品和店铺，再套用平台/市场费率、物流费、活动折扣和利润底线，确认后只写入当前店铺 Listing 草稿。</p>
      </div>
      <div className="pricing-command-stats">
        <span><strong>{pricingItemsCount}</strong>待定价</span>
        <span><strong>{selectedStoreLabel}</strong>目标店铺</span>
        <span><strong>{pricingTemplateLabel}</strong>模板</span>
        <span className={ready ? 'is-ready' : 'is-blocked'}><strong>{readinessLabel}</strong>状态</span>
      </div>
    </section>
  )
}

export function PricingResultPanel({
  result,
  isConfigurationRequired,
  pricingDataGaps,
  confirmMessage,
  confirmedProductId,
  selectedPricingItem,
  selectedItemId,
  selectedStoreId,
  confirmingTier,
  onNavigate,
  onConfirmPrice,
}: {
  result: PriceRecommendationData | null
  isConfigurationRequired: boolean
  pricingDataGaps: string[]
  confirmMessage: string
  confirmedProductId: string
  selectedPricingItem?: PricingWorkbenchItem
  selectedItemId: string
  selectedStoreId: string
  confirmingTier: string
  onNavigate: (route: string) => void
  onConfirmPrice: (tier: 'conservative' | 'balanced' | 'aggressive') => void
}) {
  return (
    <>
      {isConfigurationRequired && result && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-[var(--color-warning)]">配置未完成</p>
            <p className="text-xs mt-1 text-[var(--color-muted)]">{result.message || result.note}</p>
            {pricingDataGaps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {pricingDataGaps.map(gap => (
                  <span key={gap} className="rounded px-2 py-0.5 text-[11px]" style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                    {labelBusinessCode(gap)}
                  </span>
                ))}
              </div>
            )}
            {pricingDataGaps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pricingDataGaps.map(gap => {
                  const action = businessActionForCode(gap)
                  return (
                    <button key={`${gap}-${action.route}`} onClick={() => onNavigate(action.route)} className="text-[11px] text-[var(--color-primary)] hover:underline">
                      {action.label}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {confirmMessage && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg)]">
          <span>{confirmMessage}</span>
          {confirmedProductId && (
            <button onClick={() => onNavigate(`/publish?product_id=${confirmedProductId}`)} className="rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">
              进入平台刊登
            </button>
          )}
        </div>
      )}
      {result?.status === 'ready' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(['conservative', 'balanced', 'aggressive'] as const).map(tier => {
              const rec = result.recommendations[tier]
              if (!rec) return null
              return (
                <Card key={tier} className="pricing-result-card">
                  <CardContent className="pt-4 text-center">
                    <div className="flex justify-center mb-2">
                      {tier === 'conservative' ? <Shield className="w-5 h-5" style={{ color: 'var(--color-info)' }} /> : tier === 'balanced' ? <Target className="w-5 h-5" style={{ color: 'var(--color-success)' }} /> : <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
                    </div>
                    <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>{rec.label}</p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>¥{rec.selling_price}</p>
                    {rec.selling_price_local != null && <p className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>{rec.currency} {rec.selling_price_local}</p>}
                    {rec.effective_selling_price_rmb != null && rec.effective_selling_price_rmb !== rec.selling_price && <p className="text-[11px] mt-1 text-[var(--color-muted)]">折后实收 ¥{rec.effective_selling_price_rmb.toFixed(2)}</p>}
                    {rec.competition_position && <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{rec.competition_position === 'below_band' ? '低于竞品价格带' : rec.competition_position === 'above_band' ? '高于竞品价格带' : '位于竞品价格带内'}</p>}
                    <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>净利润率 {rec.net_profit_pct}%</p>
                    {rec.profit_floor_applied && <p className="mt-1 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]">已触发最低利润底线</p>}
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>净利润 ¥{rec.net_profit_rmb.toFixed(2)}</p>
                    </div>
                    <button onClick={() => onConfirmPrice(tier)} disabled={!selectedItemId || !selectedStoreId || confirmingTier === tier || !rec.selling_price_local} className="mt-3 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40">
                      {confirmingTier === tier ? '确认中...' : '确认并创建草稿'}
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <PricingDecisionContext result={result} item={selectedPricingItem} />
        </div>
      )}
    </>
  )
}

export function PricingSummaryRail({
  result,
  sourcePrice,
  activityDiscount,
  minProfit,
  selectedFeeTemplate,
  platform,
  market,
  selectedPricingItem,
  selectedStoreId,
  selectedAdjustmentTemplate,
  shippingCost,
  targetProfit,
  feeLoading,
  onOpenSettings,
}: {
  result: PriceRecommendationData | null
  sourcePrice: string
  activityDiscount: string
  minProfit: string
  selectedFeeTemplate?: FeeRateItem
  platform: string
  market: string
  selectedPricingItem?: PricingWorkbenchItem
  selectedStoreId: string
  selectedAdjustmentTemplate?: PricingAdjustmentTemplateItem
  shippingCost: string
  targetProfit: string
  feeLoading: boolean
  onOpenSettings: () => void
}) {
  return (
    <div className="space-y-3">
      <StatCard label="采购+物流成本" value={result?.pricing_adjustments ? `¥${result.pricing_adjustments.total_cost_rmb}` : sourcePrice ? `¥${sourcePrice}` : '--'} icon={<TrendingUp className="w-4 h-4" />} />
      <StatCard label="平台费率" value={result?.estimated_fee_pct == null ? '待配置' : `${result.estimated_fee_pct}%`} icon={<Calculator className="w-4 h-4" />} />
      <StatCard label="推荐售价(平衡)" value={result?.status === 'ready' && result.recommendations.balanced ? `¥${result.recommendations.balanced.selling_price}` : '--'} icon={<Target className="w-4 h-4" />} change={result?.status === 'ready' ? result.recommendations.balanced?.net_profit_pct : undefined} />
      <div data-ui="pricing-activity-price-preview" className="pricing-summary-card rounded-[var(--radius-xl)] p-4 text-xs">
        <p className="font-semibold text-[var(--color-fg)]">活动价口径</p>
        <p className="mt-2 text-[var(--color-muted)]">活动折扣：{activityDiscount ? `${activityDiscount}%` : '未设置'}</p>
        <p className="mt-1 text-[var(--color-muted)]">平衡折后实收：{result?.status === 'ready' && result.recommendations.balanced?.effective_selling_price_rmb != null ? `¥${result.recommendations.balanced.effective_selling_price_rmb.toFixed(2)}` : '计算后显示'}</p>
        <p className="mt-1 text-[var(--color-muted)]">最低利润底线：{minProfit ? `¥${minProfit}` : '未设置'}</p>
      </div>
      {result?.competitor_price_band && <StatCard label="竞品价格带" value={`${result.competitor_price_band.currency} ${result.competitor_price_band.min}-${result.competitor_price_band.max}`} icon={<Shield className="w-4 h-4" />} />}
      <PricingFeeTemplatePanel template={selectedFeeTemplate} platform={platform || selectedPricingItem?.platform || ''} market={market || selectedPricingItem?.market || ''} loading={feeLoading} onOpenSettings={onOpenSettings} />
      <PricingTemplateStorePreview item={selectedPricingItem} storeId={selectedStoreId} feeTemplate={selectedFeeTemplate} adjustmentTemplate={selectedAdjustmentTemplate} result={result} shippingCost={shippingCost} activityDiscount={activityDiscount} minProfit={minProfit} targetProfit={targetProfit} />
      <div className="pricing-tip-panel rounded-[var(--radius-xl)] p-4">
        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
          <strong>💡 定价提示</strong><br />
          保守定价适合新上架获取初始销量<br />
          平衡定价适合稳定运营<br />
          激进定价适合爆款或独占品类
        </p>
      </div>
    </div>
  )
}
