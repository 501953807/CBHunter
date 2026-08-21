import { Calculator, Shield, Target, TrendingUp, Zap } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import { StatCard } from '../../components/shared/StatCard'
import { PricingItemSelector } from './PricingItemSelector'
import { PricingTemplateStorePreview } from './PricingTemplateStorePreview'
import { PricingFeeTemplatePanel } from './PricingFeeTemplatePanel'
import { PricingDecisionContext } from './PricingDecisionContext'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../../api/pricing'
import type { FeeRateItem, PricingAdjustmentTemplateItem } from '../../api/settings'
import { businessActionForCode, labelBusinessCode } from '../../utils/businessLabels'

type OptionItem = { id: string; label: string; flag?: string }

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

export function PricingInputPanel({
  workbenchLoading,
  workbenchError,
  onReloadWorkbench,
  initialProductId,
  initialTargetPlatform,
  initialTargetStore,
  initialTargetMarket,
  pricingItems,
  selectedItemId,
  selectedStoreId,
  onSelectItem,
  onSelectStore,
  sourcePrice,
  platform,
  market,
  targetProfit,
  targetProfitSliderValue,
  pricingMode,
  shippingCost,
  activityDiscount,
  minProfit,
  selectedPricingTemplateId,
  pricingPlatforms,
  markets,
  matchingPricingTemplates,
  savingTemplate,
  loading,
  onChangeSourcePrice,
  onChangePlatform,
  onChangeMarket,
  onChangePricingMode,
  onChangeTargetProfit,
  onApplyPricingTemplate,
  onSavePricingTemplate,
  onChangeShippingCost,
  onChangeActivityDiscount,
  onChangeMinProfit,
  onRecommend,
}: {
  workbenchLoading: boolean
  workbenchError: boolean
  onReloadWorkbench: () => void
  initialProductId: string
  initialTargetPlatform: string
  initialTargetStore: string
  initialTargetMarket: string
  pricingItems: PricingWorkbenchItem[]
  selectedItemId: string
  selectedStoreId: string
  onSelectItem: (itemId: string) => void
  onSelectStore: (storeId: string) => void
  sourcePrice: string
  platform: string
  market: string
  targetProfit: string
  targetProfitSliderValue: number
  pricingMode: 'cost_based' | 'selling_based' | ''
  shippingCost: string
  activityDiscount: string
  minProfit: string
  selectedPricingTemplateId: string
  pricingPlatforms: OptionItem[]
  markets: OptionItem[]
  matchingPricingTemplates: PricingAdjustmentTemplateItem[]
  savingTemplate: boolean
  loading: boolean
  onChangeSourcePrice: (value: string) => void
  onChangePlatform: (value: string) => void
  onChangeMarket: (value: string) => void
  onChangePricingMode: (value: 'cost_based' | 'selling_based') => void
  onChangeTargetProfit: (value: string) => void
  onApplyPricingTemplate: (templateId: string) => void
  onSavePricingTemplate: () => void
  onChangeShippingCost: (value: string) => void
  onChangeActivityDiscount: (value: string) => void
  onChangeMinProfit: (value: string) => void
  onRecommend: () => void
}) {
  return (
    <Card className="pricing-panel">
      <CardContent className="pt-4 space-y-4">
        {workbenchError && (
          <div data-ui="pricing-workbench-error" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs">
            <span className="text-[var(--color-danger)]">定价商品队列加载失败，请检查后端服务或当前登录权限。</span>
            <button type="button" onClick={onReloadWorkbench} className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]">
              重新加载定价队列
            </button>
          </div>
        )}
        {workbenchLoading && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            正在加载定价商品队列...
          </div>
        )}
        {(initialProductId || initialTargetPlatform || initialTargetStore || initialTargetMarket) && (
          <div data-ui="pricing-content-context-handoff" className="pricing-context-chip flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-xs" aria-label="内容工厂带入的定价上下文">
            <span className="font-semibold text-[var(--color-fg)]">内容工厂带入</span>
            {initialProductId && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">商品 {initialProductId}</span>}
            {initialTargetPlatform && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">平台 {initialTargetPlatform}</span>}
            {initialTargetStore && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">店铺 {initialTargetStore}</span>}
            {initialTargetMarket && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">市场 {initialTargetMarket}</span>}
          </div>
        )}
        <PricingItemSelector items={pricingItems} selectedItemId={selectedItemId} selectedStoreId={selectedStoreId} onSelectItem={onSelectItem} onSelectStore={onSelectStore} />
        <div className="pricing-form-grid">
          <FormNumberField label="采购价 (RMB)" value={sourcePrice} onChange={onChangeSourcePrice} placeholder="请输入真实采购价" emphasized />
          <SelectField label="平台" value={platform} onChange={onChangePlatform} options={pricingPlatforms} />
          <SelectField label="市场" value={market} onChange={onChangeMarket} options={markets} />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
            <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => onChangePricingMode('cost_based')} />
            成本利润率
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
            <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => onChangePricingMode('selling_based')} />
            售价利润率
          </label>
        </div>
        <ProfitSlider pricingMode={pricingMode} targetProfit={targetProfit} targetProfitSliderValue={targetProfitSliderValue} onChangeTargetProfit={onChangeTargetProfit} />
        <PricingAdjustmentTemplateInputs
          selectedPricingTemplateId={selectedPricingTemplateId}
          matchingPricingTemplates={matchingPricingTemplates}
          platform={platform}
          market={market}
          savingTemplate={savingTemplate}
          shippingCost={shippingCost}
          activityDiscount={activityDiscount}
          minProfit={minProfit}
          onApplyPricingTemplate={onApplyPricingTemplate}
          onSavePricingTemplate={onSavePricingTemplate}
          onChangeShippingCost={onChangeShippingCost}
          onChangeActivityDiscount={onChangeActivityDiscount}
          onChangeMinProfit={onChangeMinProfit}
        />
        <button
          onClick={onRecommend}
          disabled={loading || !platform || !market || !sourcePrice || !targetProfit || !pricingMode}
          className="w-full py-2.5 rounded-full text-[var(--color-primary-text)] font-medium disabled:opacity-40 transition-colors"
          style={{ background: 'var(--gradient-accent)' }}
        >
          {loading ? '计算中...' : '计算推荐售价'}
        </button>
      </CardContent>
    </Card>
  )
}

function FormNumberField({ label, value, onChange, placeholder, emphasized = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  emphasized?: boolean
}) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={emphasized ? 'w-full text-lg font-bold rounded-lg px-3 py-2 outline-none' : 'w-full rounded-lg px-3 py-2 text-sm outline-none'}
        style={{ background: emphasized ? 'var(--color-bg)' : 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: OptionItem[]
}) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg px-3 py-2 outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
        {options.map(option => <option key={option.id} value={option.id}>{option.flag ? `${option.flag} ` : ''}{option.label}</option>)}
      </select>
    </div>
  )
}

function ProfitSlider({
  pricingMode,
  targetProfit,
  targetProfitSliderValue,
  onChangeTargetProfit,
}: {
  pricingMode: 'cost_based' | 'selling_based' | ''
  targetProfit: string
  targetProfitSliderValue: number
  onChangeTargetProfit: (value: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
          {pricingMode === 'cost_based' ? '目标成本利润率' : pricingMode === 'selling_based' ? '目标售价净利率' : '目标利润率'}
        </label>
        <span className="text-xs font-medium text-[var(--color-primary)]">{targetProfit || targetProfitSliderValue}%</span>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" data-ui="pricing-profit-slider">
        <input aria-label="目标利润率滑块" type="range" min="0.1" max="60" step="0.1" value={targetProfitSliderValue} onChange={event => onChangeTargetProfit(event.target.value)} className="w-full accent-[var(--color-primary)]" />
        <div className="mt-2 flex items-center gap-3">
          <input
            type="number"
            min="0.1"
            max="60"
            step="0.1"
            value={targetProfit}
            onChange={event => onChangeTargetProfit(event.target.value)}
            placeholder="请输入目标利润率"
            className="w-32 rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
          />
          <p className="text-xs text-[var(--color-muted)]">拖动滑块快速调整利润率，精确数值可在输入框修正。</p>
        </div>
      </div>
    </div>
  )
}

function PricingAdjustmentTemplateInputs({
  selectedPricingTemplateId,
  matchingPricingTemplates,
  platform,
  market,
  savingTemplate,
  shippingCost,
  activityDiscount,
  minProfit,
  onApplyPricingTemplate,
  onSavePricingTemplate,
  onChangeShippingCost,
  onChangeActivityDiscount,
  onChangeMinProfit,
}: {
  selectedPricingTemplateId: string
  matchingPricingTemplates: PricingAdjustmentTemplateItem[]
  platform: string
  market: string
  savingTemplate: boolean
  shippingCost: string
  activityDiscount: string
  minProfit: string
  onApplyPricingTemplate: (templateId: string) => void
  onSavePricingTemplate: () => void
  onChangeShippingCost: (value: string) => void
  onChangeActivityDiscount: (value: string) => void
  onChangeMinProfit: (value: string) => void
}) {
  return (
    <div data-ui="pricing-adjustment-template-inputs" className="pricing-form-panel pricing-form-grid rounded-[var(--radius-xl)] p-3">
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">定价附加模板</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">复用当前平台/市场的物流费、活动折扣和最低利润底线。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedPricingTemplateId} onChange={event => onApplyPricingTemplate(event.target.value)} className="min-w-56 rounded-lg px-3 py-2 text-xs outline-none" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}>
            <option value="">{matchingPricingTemplates.length ? '选择定价模板' : '当前平台/市场暂无模板'}</option>
            {matchingPricingTemplates.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}
          </select>
          <button type="button" onClick={onSavePricingTemplate} disabled={!platform || !market || savingTemplate} className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary)] disabled:opacity-40 hover:bg-[var(--color-primary-light)]">
            {savingTemplate ? '保存中...' : '保存当前为模板'}
          </button>
        </div>
      </div>
      <FormNumberField label="物流费 (RMB)" value={shippingCost} onChange={onChangeShippingCost} placeholder="如 4.00" />
      <FormNumberField label="活动折扣 (%)" value={activityDiscount} onChange={onChangeActivityDiscount} placeholder="如 10" />
      <FormNumberField label="最低利润额 (RMB)" value={minProfit} onChange={onChangeMinProfit} placeholder="如 12.00" />
      <p className="col-span-full text-[11px] leading-5 text-[var(--color-muted)]">
        物流费计入总成本；活动折扣按成交后实收折算；最低利润额用于防止活动价或平台费压穿利润底线。
      </p>
    </div>
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
