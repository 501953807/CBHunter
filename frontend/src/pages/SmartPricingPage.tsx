import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator, TrendingUp, Target, Shield, Zap } from 'lucide-react'
import { PageHeader } from '../components/shared/PageHeader'
import { Card, CardContent } from '../components/ui/Card'
import { StatCard } from '../components/shared/StatCard'
import { confirmPricing, getPricingWorkbench, recommendPrice } from '../api/pricing'
import { listFeeRates, updatePricingAdjustmentTemplates, type FeeRateItem, type PricingAdjustmentTemplateItem } from '../api/settings'
import { useConfig } from '../hooks/useConfig'
import { logger } from '../utils/logger'
import { filterPlatformsByCapability } from '../utils/platformCapabilities'
import { EvidenceBanner } from '../components/shared/EvidenceBanner'
import type { PriceRecommendationData, PricingWorkbenchItem } from '../api/pricing'
import type { ApiResponse } from '../types/common'
import { businessActionForCode, labelBusinessCode } from '../utils/businessLabels'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PricingItemSelector } from '../features/pricing/PricingItemSelector'
import { ContentListingStageRail } from '../features/content-planner/ContentListingStageRail'
import { PricingTemplateStorePreview } from '../features/pricing/PricingTemplateStorePreview'

export default function SmartPricingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialContentItemId = searchParams.get('content_item_id') || ''
  const initialProductId = searchParams.get('product_id') || ''
  const initialTargetPlatform = searchParams.get('target_platform') || ''
  const initialTargetStore = searchParams.get('target_store') || ''
  const initialTargetMarket = searchParams.get('target_market') || ''
  const { platforms, markets } = useConfig()
  const [sourcePrice, setSourcePrice] = useState('')
  const [platform, setPlatform] = useState('')
  const [market, setMarket] = useState('')
  const [targetProfit, setTargetProfit] = useState('')
  const [shippingCost, setShippingCost] = useState('')
  const [activityDiscount, setActivityDiscount] = useState('')
  const [minProfit, setMinProfit] = useState('')
  const [selectedPricingTemplateId, setSelectedPricingTemplateId] = useState('')
  const [pricingMode, setPricingMode] = useState<'cost_based' | 'selling_based' | ''>('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [result, setResult] = useState<PriceRecommendationData | null>(null)
  const [evidence, setEvidence] = useState<ApiResponse<PriceRecommendationData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [confirmingTier, setConfirmingTier] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmedProductId, setConfirmedProductId] = useState('')
  const pricingWorkbenchQuery = useQuery({
    queryKey: ['pricing-workbench'],
    queryFn: getPricingWorkbench,
  })
  const feeRatesQuery = useQuery({
    queryKey: ['settings-fee-rates'],
    queryFn: listFeeRates,
  })
  const pricingItems = pricingWorkbenchQuery.data?.data?.items || []
  const feeTemplates = feeRatesQuery.data?.data?.flat || []
  const pricingAdjustmentTemplates = feeRatesQuery.data?.data?.pricing_adjustment_templates || []
  const pricingPlatforms = filterPlatformsByCapability(platforms, 'pricing')
  const isConfigurationRequired = result?.status === 'configuration_required'
  const pricingDataGaps = result?.data_gaps || []
  const selectedPricingItem = pricingItems.find(item => item.id === selectedItemId)
  const selectedFeeTemplate = findFeeTemplate(feeTemplates, platform, market)
  const matchingPricingTemplates = pricingAdjustmentTemplates.filter(template => template.platform === platform && template.market === market)
  const selectedAdjustmentTemplate = pricingAdjustmentTemplates.find(template => template.id === selectedPricingTemplateId)
  const targetProfitSliderValue = normalizeProfitSliderValue(targetProfit)

  useEffect(() => {
    if (pricingWorkbenchQuery.error) logger.error('Load pricing workbench failed', pricingWorkbenchQuery.error)
  }, [pricingWorkbenchQuery.error])

  useEffect(() => {
    if (selectedItemId || pricingItems.length === 0) return
    const direct = initialContentItemId
      ? pricingItems.find(item => item.id === initialContentItemId || item.work_item_id === initialContentItemId)
      : null
    const byProduct = initialProductId
      ? pricingItems.find(item => matchesPricingProduct(item, initialProductId))
      : null
    const initial = direct || byProduct
    if (initial) {
      handleSelectItem(initial.id, {
        targetPlatform: initialTargetPlatform,
        targetStore: initialTargetStore,
        targetMarket: initialTargetMarket,
      })
    }
  }, [initialContentItemId, initialProductId, initialTargetPlatform, initialTargetStore, initialTargetMarket, pricingItems, selectedItemId])

  const handleSelectItem = (
    itemId: string,
    routeContext?: { targetPlatform?: string; targetStore?: string; targetMarket?: string },
  ) => {
    setSelectedItemId(itemId)
    const item = pricingItems.find(entry => entry.id === itemId)
    if (!item) {
      setSelectedStoreId('')
      return
    }
    const overrideStoreId = item.listing_store_override?.store_id || ''
    const routeStoreId = routeContext?.targetStore && item.store_options.some(store => store.id === routeContext.targetStore)
      ? routeContext.targetStore
      : ''
    const defaultStoreId = item.store_options.some(store => store.id === overrideStoreId) ? overrideStoreId : item.store_options[0]?.id || ''
    setSelectedStoreId(routeStoreId || defaultStoreId)
    setSourcePrice(String(item.source_price_rmb))
    setShippingCost('')
    setActivityDiscount('')
    setMinProfit('')
    setSelectedPricingTemplateId('')
    setPlatform(routeContext?.targetPlatform || item.platform)
    setMarket(routeContext?.targetMarket || item.market)
    setResult(null)
    setEvidence(null)
    setConfirmMessage('')
    setConfirmedProductId('')
  }

  const handleApplyPricingTemplate = (templateId: string) => {
    setSelectedPricingTemplateId(templateId)
    const template = pricingAdjustmentTemplates.find(item => item.id === templateId)
    if (!template) return
    setShippingCost(String(template.shipping_cost_rmb))
    setActivityDiscount(String(template.activity_discount_pct))
    setMinProfit(String(template.min_profit_rmb))
    setTargetProfit(String(template.target_profit_pct))
  }

  const handleSavePricingTemplate = async () => {
    if (!platform || !market) return
    setSavingTemplate(true)
    try {
      const id = `${platform}_${market}_default`
      const nextTemplate: PricingAdjustmentTemplateItem = {
        id,
        label: `${platform}/${market} 常规定价模板`,
        platform,
        market,
        shipping_cost_rmb: optionalNumber(shippingCost) ?? 0,
        activity_discount_pct: optionalNumber(activityDiscount) ?? 0,
        min_profit_rmb: optionalNumber(minProfit) ?? 0,
        target_profit_pct: optionalNumber(targetProfit) ?? 20,
      }
      const others = pricingAdjustmentTemplates.filter(template => template.id !== id)
      await updatePricingAdjustmentTemplates([...others, nextTemplate])
      setSelectedPricingTemplateId(id)
      await feeRatesQuery.refetch()
      setConfirmMessage('定价附加模板已保存，可在同平台/市场商品中复用')
    } catch (e: any) {
      logger.error('Save pricing adjustment template failed', e)
      setConfirmMessage(e?.response?.data?.detail || '定价附加模板保存失败')
    }
    setSavingTemplate(false)
  }

  const handleRecommend = async () => {
    setLoading(true)
    try {
      const res = await recommendPrice({
        source_price_rmb: Number(sourcePrice),
        platform, market,
        target_profit_pct: Number(targetProfit),
        pricing_mode: pricingMode as 'cost_based' | 'selling_based',
        content_item_id: selectedItemId || undefined,
        shipping_cost_rmb: optionalNumber(shippingCost),
        activity_discount_pct: optionalNumber(activityDiscount),
        min_profit_rmb: optionalNumber(minProfit),
      })
      setEvidence(res)
      if (res.data) setResult(res.data)
    } catch (e: any) { logger.error('Pricing failed', e) }
    setLoading(false)
  }

  const handleConfirmPrice = async (tier: 'conservative' | 'balanced' | 'aggressive') => {
    const rec = result?.recommendations[tier]
    if (!selectedItemId || !selectedStoreId || !pricingMode || !targetProfit || !rec?.selling_price_local) return
    setConfirmingTier(tier)
    setConfirmMessage('')
    setConfirmedProductId('')
    try {
      const res = await confirmPricing({
        content_item_id: selectedItemId,
        selling_price_rmb: rec.selling_price,
        selling_price_local: rec.selling_price_local,
        currency: rec.currency,
        pricing_tier: tier,
	        pricing_mode: pricingMode,
	        target_profit_pct: Number(targetProfit) + (tier === 'balanced' ? 10 : tier === 'aggressive' ? 20 : 0),
	        platform_account_id: selectedStoreId || undefined,
	        pricing_template_id: selectedAdjustmentTemplate?.id,
	        pricing_template_label: selectedAdjustmentTemplate?.label,
	        fee_template_id: selectedFeeTemplate?.id,
	        fee_template_label: selectedFeeTemplate ? `${selectedFeeTemplate.platform}/${selectedFeeTemplate.market}` : undefined,
	        shipping_cost_rmb: optionalNumber(shippingCost),
	        activity_discount_pct: optionalNumber(activityDiscount),
	        min_profit_rmb: optionalNumber(minProfit),
	        estimated_fee_pct: result?.estimated_fee_pct,
	        exchange_rate: result?.exchange_rate,
	      })
      setConfirmedProductId(res.data?.product_id || '')
      setConfirmMessage(res.data?.listing_id ? '已确认价格并创建本地 Listing 草稿' : res.data?.note || '价格确认未完成')
    } catch (e: any) {
      logger.error('Confirm pricing failed', e)
      setConfirmMessage(e?.response?.data?.detail || '价格确认失败')
    }
    setConfirmingTier('')
  }

  return (
    <div className="pricing-shell space-y-6 page-enter">
      <ContentListingStageRail />
      <PageHeader title="智能定价" description="成本 + 费率 + 利润 = 自动推荐最优售价" />
      <EvidenceBanner evidence={evidence} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Left: Inputs */}
        <div className="space-y-4">
          <Card className="pricing-panel">
            <CardContent className="pt-4 space-y-4">
              {pricingWorkbenchQuery.isError && (
                <div
                  data-ui="pricing-workbench-error"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-3 py-2 text-xs"
                >
                  <span className="text-[var(--color-danger)]">定价商品队列加载失败，请检查后端服务或当前登录权限。</span>
                  <button
                    type="button"
                    onClick={() => pricingWorkbenchQuery.refetch()}
                    className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-[var(--color-danger)] hover:bg-[var(--color-surface)]"
                  >
                    重新加载定价队列
                  </button>
                </div>
              )}
              {pricingWorkbenchQuery.isLoading && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
                  正在加载定价商品队列...
                </div>
              )}
              {(initialProductId || initialTargetPlatform || initialTargetStore || initialTargetMarket) && (
                <div
                  data-ui="pricing-content-context-handoff"
                  className="pricing-context-chip flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] px-3 py-2 text-xs"
                  aria-label="内容工厂带入的定价上下文"
                >
                  <span className="font-semibold text-[var(--color-fg)]">内容工厂带入</span>
                  {initialProductId && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">商品 {initialProductId}</span>}
                  {initialTargetPlatform && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">平台 {initialTargetPlatform}</span>}
                  {initialTargetStore && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">店铺 {initialTargetStore}</span>}
                  {initialTargetMarket && <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-[var(--color-muted)]">市场 {initialTargetMarket}</span>}
                </div>
              )}
              <PricingItemSelector items={pricingItems} selectedItemId={selectedItemId} selectedStoreId={selectedStoreId} onSelectItem={handleSelectItem} onSelectStore={setSelectedStoreId} />
              <div className="pricing-form-grid">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>采购价 (RMB)</label>
                  <input
                    type="number" min="0.01" step="0.01" value={sourcePrice}
                    onChange={e => setSourcePrice(e.target.value)}
                    placeholder="请输入真实采购价"
                    className="w-full text-lg font-bold rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>平台</label>
                  <select
                    value={platform} onChange={e => setPlatform(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {pricingPlatforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-muted)' }}>市场</label>
                  <select
                    value={market} onChange={e => setMarket(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 outline-none"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  >
                    {markets.map(m => <option key={m.id} value={m.id}>{m.flag ? `${m.flag} ` : ''}{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
                  <input type="radio" checked={pricingMode === 'cost_based'} onChange={() => setPricingMode('cost_based')} />
                  成本利润率
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-fg)' }}>
                  <input type="radio" checked={pricingMode === 'selling_based'} onChange={() => setPricingMode('selling_based')} />
                  售价利润率
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {pricingMode === 'cost_based' ? '目标成本利润率' : pricingMode === 'selling_based' ? '目标售价净利率' : '目标利润率'}
                  </label>
                  <span className="text-xs font-medium text-[var(--color-primary)]">{targetProfit || targetProfitSliderValue}%</span>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" data-ui="pricing-profit-slider">
                  <input
                    aria-label="目标利润率滑块"
                    type="range"
                    min="0.1"
                    max="60"
                    step="0.1"
                    value={targetProfitSliderValue}
                    onChange={e => setTargetProfit(e.target.value)}
                    className="w-full accent-[var(--color-primary)]"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number" min="0.1" max="60" step="0.1" value={targetProfit}
                      onChange={e => setTargetProfit(e.target.value)}
                      placeholder="请输入目标利润率"
                      className="w-32 rounded-lg px-3 py-2 outline-none"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                    />
                    <p className="text-xs text-[var(--color-muted)]">拖动滑块快速调整利润率，精确数值可在输入框修正。</p>
                  </div>
                </div>
              </div>

              <div
                data-ui="pricing-adjustment-template-inputs"
                className="pricing-form-panel pricing-form-grid rounded-[var(--radius-xl)] p-3"
              >
                  <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-fg)]">定价附加模板</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">复用当前平台/市场的物流费、活动折扣和最低利润底线。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedPricingTemplateId}
                      onChange={e => handleApplyPricingTemplate(e.target.value)}
                      className="min-w-56 rounded-lg px-3 py-2 text-xs outline-none"
                      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                    >
                      <option value="">{matchingPricingTemplates.length ? '选择定价模板' : '当前平台/市场暂无模板'}</option>
                      {matchingPricingTemplates.map(template => (
                        <option key={template.id} value={template.id}>{template.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleSavePricingTemplate}
                      disabled={!platform || !market || savingTemplate}
                      className="rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs text-[var(--color-primary)] disabled:opacity-40 hover:bg-[var(--color-primary-light)]"
                    >
                      {savingTemplate ? '保存中...' : '保存当前为模板'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">物流费 (RMB)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={e => setShippingCost(e.target.value)}
                    placeholder="如 4.00"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">活动折扣 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="95"
                    step="0.1"
                    value={activityDiscount}
                    onChange={e => setActivityDiscount(e.target.value)}
                    placeholder="如 10"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">最低利润额 (RMB)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minProfit}
                    onChange={e => setMinProfit(e.target.value)}
                    placeholder="如 12.00"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-fg)' }}
                  />
                </div>
                <p className="col-span-full text-[11px] leading-5 text-[var(--color-muted)]">
                  物流费计入总成本；活动折扣按成交后实收折算；最低利润额用于防止活动价或平台费压穿利润底线。
                </p>
              </div>

              <button
                onClick={handleRecommend}
                disabled={loading || !platform || !market || !sourcePrice || !targetProfit || !pricingMode}
                className="w-full py-2.5 rounded-full text-[var(--color-primary-text)] font-medium disabled:opacity-40 transition-colors"
                style={{ background: 'var(--gradient-accent)' }}
              >
                {loading ? '计算中...' : '计算推荐售价'}
              </button>
            </CardContent>
          </Card>

          {/* Results */}
          {isConfigurationRequired && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-[var(--color-warning)]">配置未完成</p>
                <p className="text-xs mt-1 text-[var(--color-muted)]">{result.message || result.note}</p>
                {pricingDataGaps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pricingDataGaps.map((gap: string) => (
                      <span
                        key={gap}
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}
                      >
                        {labelBusinessCode(gap)}
                      </span>
                    ))}
                  </div>
                )}
                {pricingDataGaps.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pricingDataGaps.map((gap: string) => {
                      const action = businessActionForCode(gap)
                      return (
                        <button key={`${gap}-${action.route}`} onClick={() => navigate(action.route)} className="text-[11px] text-[var(--color-primary)] hover:underline">
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
                <button
                  onClick={() => navigate(`/publish?product_id=${confirmedProductId}`)}
                  className="rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                >
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
                          {tier === 'conservative' ? <Shield className="w-5 h-5" style={{ color: 'var(--color-info)' }} />
                           : tier === 'balanced' ? <Target className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                           : <Zap className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />}
                        </div>
                        <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>{rec.label}</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>¥{rec.selling_price}</p>
                        {rec.selling_price_local != null && <p className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>{rec.currency} {rec.selling_price_local}</p>}
                        {rec.effective_selling_price_rmb != null && rec.effective_selling_price_rmb !== rec.selling_price && (
                          <p className="text-[11px] mt-1 text-[var(--color-muted)]">折后实收 ¥{rec.effective_selling_price_rmb.toFixed(2)}</p>
                        )}
                        {rec.competition_position && <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{rec.competition_position === 'below_band' ? '低于竞品价格带' : rec.competition_position === 'above_band' ? '高于竞品价格带' : '位于竞品价格带内'}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>净利润率 {rec.net_profit_pct}%</p>
                        {rec.profit_floor_applied && (
                          <p className="mt-1 rounded-full bg-[var(--color-warning-light)] px-2 py-0.5 text-[11px] text-[var(--color-warning)]">已触发最低利润底线</p>
                        )}
                        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                            净利润 ¥{rec.net_profit_rmb.toFixed(2)}
                          </p>
                        </div>
                        <button onClick={() => handleConfirmPrice(tier)} disabled={!selectedItemId || !selectedStoreId || confirmingTier === tier || !rec.selling_price_local} className="mt-3 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-fg)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40">
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
        </div>

        {/* Right: Summary cards */}
        <div className="space-y-3">
          <StatCard
            label="采购+物流成本"
            value={result?.pricing_adjustments ? `¥${result.pricing_adjustments.total_cost_rmb}` : sourcePrice ? `¥${sourcePrice}` : '--'}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard
            label="平台费率"
            value={result?.estimated_fee_pct == null ? '待配置' : `${result.estimated_fee_pct}%`}
            icon={<Calculator className="w-4 h-4" />}
          />
          <StatCard
            label="推荐售价(平衡)"
            value={result?.status === 'ready' && result.recommendations.balanced ? `¥${result.recommendations.balanced.selling_price}` : '--'}
            icon={<Target className="w-4 h-4" />}
            change={result?.status === 'ready' ? result.recommendations.balanced?.net_profit_pct : undefined}
          />
          <div data-ui="pricing-activity-price-preview" className="pricing-summary-card rounded-[var(--radius-xl)] p-4 text-xs">
            <p className="font-semibold text-[var(--color-fg)]">活动价口径</p>
            <p className="mt-2 text-[var(--color-muted)]">活动折扣：{activityDiscount ? `${activityDiscount}%` : '未设置'}</p>
            <p className="mt-1 text-[var(--color-muted)]">平衡折后实收：{result?.status === 'ready' && result.recommendations.balanced?.effective_selling_price_rmb != null ? `¥${result.recommendations.balanced.effective_selling_price_rmb.toFixed(2)}` : '计算后显示'}</p>
            <p className="mt-1 text-[var(--color-muted)]">最低利润底线：{minProfit ? `¥${minProfit}` : '未设置'}</p>
          </div>
          {result?.competitor_price_band && (
            <StatCard
              label="竞品价格带"
              value={`${result.competitor_price_band.currency} ${result.competitor_price_band.min}-${result.competitor_price_band.max}`}
              icon={<Shield className="w-4 h-4" />}
            />
          )}
          <PricingFeeTemplatePanel
            template={selectedFeeTemplate}
            platform={platform || selectedPricingItem?.platform || ''}
            market={market || selectedPricingItem?.market || ''}
            loading={feeRatesQuery.isLoading}
            onOpenSettings={() => navigate('/settings/fees')}
          />
          <PricingTemplateStorePreview
            item={selectedPricingItem}
            storeId={selectedStoreId}
            feeTemplate={selectedFeeTemplate}
            adjustmentTemplate={selectedAdjustmentTemplate}
            result={result}
            shippingCost={shippingCost}
            activityDiscount={activityDiscount}
            minProfit={minProfit}
            targetProfit={targetProfit}
          />
          <div
            className="pricing-tip-panel rounded-[var(--radius-xl)] p-4"
          >
            <p className="text-xs" style={{ color: 'var(--color-primary)' }}>
              <strong>💡 定价提示</strong><br />
              保守定价适合新上架获取初始销量<br />
              平衡定价适合稳定运营<br />
              激进定价适合爆款或独占品类
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function matchesPricingProduct(item: PricingWorkbenchItem, productId: string) {
  return Boolean(productId && (
    item.id === productId ||
    item.work_item_id === productId ||
    item.object_refs?.some(ref => ref.type === 'product' && ref.id === productId)
  ))
}

function findFeeTemplate(templates: FeeRateItem[], platform: string, market: string) {
  if (!platform || !market) return undefined
  const expectedId = `${platform}_${market}`
  return templates.find(template => template.id === expectedId)
}

function normalizeProfitSliderValue(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 20
  return Math.min(Math.max(numeric, 0.1), 60)
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

function PricingFeeTemplatePanel({
  template,
  platform,
  market,
  loading,
  onOpenSettings,
}: {
  template?: FeeRateItem
  platform: string
  market: string
  loading: boolean
  onOpenSettings: () => void
}) {
  const hasSelection = Boolean(platform && market)
  const rows = template
    ? [
      { label: '平台佣金', value: template.commission },
      { label: '交易/支付费', value: template.transaction },
      { label: '技术服务费', value: template.tech },
      { label: '税费/VAT', value: template.low_value_tax },
    ]
    : []
  return (
    <section
      aria-label="定价模板与费用口径"
      data-ui="pricing-fee-template-panel"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">定价模板 / 费用口径</p>
          <p className="mt-1 text-[11px] text-[var(--color-muted)]">
            {hasSelection ? `${platform}/${market}` : '选择商品后自动匹配平台和市场'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
        >
          配置
        </button>
      </div>
      {loading ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-muted)]">
          正在读取费率模板...
        </p>
      ) : template ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-bg)] px-3 py-2 text-xs">
            <span className="text-[var(--color-muted)]">综合费率</span>
            <span className="font-semibold text-[var(--color-fg)]">{template.total_pct || percentLabel(template.total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {rows.map(row => (
              <div key={row.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[11px]">
                <p className="text-[var(--color-muted)]">{row.label}</p>
                <p className="font-medium text-[var(--color-fg)]">{percentLabel(row.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-[var(--color-muted)]">
            计算推荐售价时读取当前模板；平台真实账单同步后由财务护卫复核，不用前端估算冒充最终利润。
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl border border-dashed border-[var(--color-warning)] bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning)]">
            {hasSelection ? '当前平台/市场缺少费率模板，无法输出真实推荐售价。' : '请选择待定价商品以匹配费率模板。'}
          </p>
          {hasSelection && (
            <button type="button" onClick={onOpenSettings} className="text-xs text-[var(--color-primary)] hover:underline">
              前往设置中心维护费率与汇率
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function percentLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '待配置'
  return `${(Number(value) * 100).toFixed(1)}%`
}

function PricingDecisionContext({ result, item }: { result: PriceRecommendationData; item?: PricingWorkbenchItem }) {
  const balanced = result.recommendations.balanced
  const feePct = result.estimated_fee_pct ?? 0
  const sellingPrice = balanced?.selling_price ?? 0
  const effectiveSellingPrice = balanced?.effective_selling_price_rmb ?? sellingPrice
  const platformFee = effectiveSellingPrice * feePct / 100
  const totalCost = result.pricing_adjustments?.total_cost_rmb ?? result.source_price_rmb
  const netProfit = balanced?.net_profit_rmb ?? null
  const maxAbs = Math.max(totalCost, effectiveSellingPrice, platformFee, Math.abs(netProfit ?? 0), 1)
  const profitRows = [
    { label: '采购+物流总成本', value: totalCost, tone: 'var(--color-danger)' },
    { label: '折后实收价格', value: effectiveSellingPrice, tone: 'var(--color-success)' },
    { label: '平台费 estimated_fee_pct', value: platformFee, tone: 'var(--color-warning)' },
    { label: '净利润', value: netProfit ?? 0, tone: (netProfit ?? 0) < 0 ? 'var(--color-danger)' : 'var(--color-primary)' },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-[var(--color-fg)]">定价历史</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            当前展示本次定价快照；后续接入真实调价日志后按店铺、平台和商品版本形成价格时间线。
          </p>
          <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--color-muted)]">{item?.product_name || result.product_name || '当前定价商品'}</span>
              <span className="font-medium text-[var(--color-fg)]">{balanced ? `¥${balanced.selling_price}` : '--'}</span>
            </div>
            <p className="mt-1 text-[var(--color-muted)]">
              {[result.platform, result.market, balanced?.label].filter(Boolean).join(' · ') || '平台/市场待选择'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-semibold text-[var(--color-fg)]">竞品价格带对比</p>
          {result.competitor_price_band ? (
            <div className="mt-3 space-y-2 text-xs">
              {[
                ['最低价', result.competitor_price_band.min],
                ['中位价', result.competitor_price_band.median],
                ['最高价', result.competitor_price_band.max],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-[var(--color-bg)] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-muted)]">{label as string}</span>
                    <span className="font-medium text-[var(--color-fg)]">{result.competitor_price_band?.currency} {Number(value).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-[var(--color-muted)]">样本 {result.competitor_price_band.sample_count} 个；用于判断推荐售价相对竞品区间的位置。</p>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-muted)]">
              暂无真实竞品价格样本；补充竞品监控后展示平台价格带，不使用模拟竞品。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4" data-ui="pricing-profit-breakdown">
          <p className="text-sm font-semibold text-[var(--color-fg)]">利润拆分</p>
          <div className="mt-3 space-y-2">
            {profitRows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--color-muted)]">{row.label}</span>
                  <span className="font-medium text-[var(--color-fg)]">¥{row.value.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-border)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(Math.abs(row.value) / maxAbs * 100, row.value ? 4 : 0)}%`, background: row.tone }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            以平衡档售价拆分采购成本、物流费、活动折扣、平台费和净利润，确认后写入本地 Listing 草稿，平台实际费用以账单同步为准。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
